import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { randomBytes, createHash, createHmac } from 'node:crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { users, memberships, sessions } from '../lib/db/schema'

// Bulk-loads a directory of documents (plus a manifest.json mapping filename ->
// access-group names) through the real web API, so ingestion/access-tagging goes
// through the same path a human upload would. Self-contained on purpose, like
// scripts/seed.ts: mints a session row directly rather than importing the
// server-only session-store, and recomputes the CSRF token the same way
// lib/csrf.ts does (HMAC of the session token under SESSION_SECRET).

type Manifest = Record<string, string[]>

async function main() {
  const email = (process.env.SEED_EMAIL ?? '').trim().toLowerCase()
  const corpusDir = process.env.CORPUS_DIR
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const sessionSecret = process.env.SESSION_SECRET
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('Set DATABASE_URL')
  if (!sessionSecret) throw new Error('Set SESSION_SECRET')
  if (!email) throw new Error('Set SEED_EMAIL')
  if (!corpusDir) throw new Error('Set CORPUS_DIR (a directory with *.md/*.txt files + manifest.json)')

  const sql = postgres(dbUrl, { max: 1 })
  const db = drizzle(sql, { schema: { users, memberships, sessions } })

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) throw new Error(`No user ${email} — run "npm run seed" first`)
  const membership = await db.query.memberships.findFirst({ where: eq(memberships.userId, user.id) })
  if (!membership) throw new Error(`User ${email} has no workspace membership`)

  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1h is plenty for a bulk load
  await db.insert(sessions).values({ tokenHash, userId: user.id, expiresAt })
  const csrf = createHmac('sha256', sessionSecret).update(token).digest('hex')
  const headers = { cookie: `cb_session=${token}`, 'x-csrf-token': csrf }

  const manifest = JSON.parse(
    readFileSync(path.join(corpusDir, 'manifest.json'), 'utf8'),
  ) as Manifest
  const wantedGroups = new Set<string>()
  for (const names of Object.values(manifest)) for (const n of names) wantedGroups.add(n)

  const groupsRes = await fetch(`${appUrl}/api/groups`, { headers })
  if (!groupsRes.ok) throw new Error(`GET /api/groups -> ${groupsRes.status}`)
  const { groups: existing } = (await groupsRes.json()) as { groups: { id: string; name: string }[] }
  const groupIdByName = new Map(existing.map((g) => [g.name, g.id]))

  for (const name of wantedGroups) {
    if (groupIdByName.has(name)) continue
    const res = await fetch(`${appUrl}/api/groups`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const { group } = (await res.json()) as { group: { id: string; name: string } }
      groupIdByName.set(group.name, group.id)
    } else if (res.status !== 409) {
      throw new Error(`create group "${name}" -> ${res.status}`)
    }
  }
  console.log(`Groups ready: ${[...groupIdByName.keys()].join(', ')}`)

  const files = readdirSync(corpusDir).filter((f) => manifest[f])
  let uploaded = 0
  let failed = 0
  for (const file of files) {
    const groupNames = manifest[file]
    const data = readFileSync(path.join(corpusDir, file))
    const form = new FormData()
    form.append('file', new Blob([data], { type: 'text/markdown' }), file)

    const upRes = await fetch(`${appUrl}/api/documents`, { method: 'POST', headers, body: form })
    if (!upRes.ok) {
      console.error(`upload failed: ${file} -> ${upRes.status}`)
      failed++
      continue
    }
    const { document } = (await upRes.json()) as { document: { id: string } }
    const groupIds = groupNames.map((n) => groupIdByName.get(n)).filter((v): v is string => !!v)

    const setRes = await fetch(`${appUrl}/api/documents/${document.id}/groups`, {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ groupIds }),
    })
    if (!setRes.ok) console.error(`set groups failed: ${file} -> ${setRes.status}`)

    uploaded++
    if (uploaded % 25 === 0) console.log(`  ${uploaded}/${files.length} uploaded`)
  }
  console.log(`Uploaded ${uploaded}/${files.length} documents (${failed} failed).`)

  const rebuildRes = await fetch(`${appUrl}/api/graph/rebuild`, { method: 'POST', headers })
  console.log(`Atlas rebuild triggered: ${rebuildRes.status}`)

  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
