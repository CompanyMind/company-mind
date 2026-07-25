import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'
import { users, workspaces, memberships } from '../lib/db/schema'

// Self-contained on purpose: this runs in a plain tsx process, so it avoids the
// app's `server-only` modules (client.ts / password.ts) and builds its own
// short-lived connection. argon2 params are echoed here; verify reads the
// params back out of the stored hash, so login stays correct regardless.
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

async function main() {
  const email = (process.env.SEED_EMAIL ?? '').trim().toLowerCase()
  const password = process.env.SEED_PASSWORD ?? ''
  const name = process.env.SEED_NAME ?? null
  const wsName = process.env.SEED_WORKSPACE ?? 'My Workspace'
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL')
  if (!email || !password) throw new Error('Set SEED_EMAIL and SEED_PASSWORD')

  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql, { schema: { users, workspaces, memberships } })

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    console.log(`User ${email} already exists — skipping.`)
    await sql.end()
    return
  }

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: await hash(password, ARGON2), name, isSuperAdmin: true })
    .returning()
  const slug =
    wsName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'workspace'
  const [ws] = await db.insert(workspaces).values({ name: wsName, slug }).returning()
  await db.insert(memberships).values({ userId: user.id, workspaceId: ws.id, role: 'owner' })

  console.log(`Seeded ${email} -> workspace "${wsName}".`)
  console.log(`Platform super-admin: ${email}`)
  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
