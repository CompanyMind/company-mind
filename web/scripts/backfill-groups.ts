import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, eq } from 'drizzle-orm'
import { groups, documents, documentGroups, workspaces } from '../lib/db/schema'

// Idempotent: ensure every workspace has an Everyone group and every existing
// document is tagged with it (so nothing is hidden by the new access filter).
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Set DATABASE_URL')
  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql, { schema: { groups, documents, documentGroups, workspaces } })

  const wss = await db.select().from(workspaces)
  for (const ws of wss) {
    let ev = await db.query.groups.findFirst({
      where: and(eq(groups.workspaceId, ws.id), eq(groups.isDefault, true)),
    })
    if (!ev) {
      ;[ev] = await db
        .insert(groups)
        .values({ workspaceId: ws.id, name: 'Everyone', slug: 'everyone', isDefault: true })
        .returning()
    }
    const docs = await db.select().from(documents).where(eq(documents.workspaceId, ws.id))
    for (const d of docs) {
      const has = await db.query.documentGroups.findFirst({
        where: and(eq(documentGroups.documentId, d.id), eq(documentGroups.groupId, ev.id)),
      })
      if (!has)
        await db
          .insert(documentGroups)
          .values({ documentId: d.id, workspaceId: ws.id, groupId: ev.id })
    }
    console.log(`workspace ${ws.name}: Everyone ready, ${docs.length} docs tagged.`)
  }
  await sql.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
