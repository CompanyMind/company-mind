import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { documents, documentGroups } from '@/lib/db/schema'

export type DocumentRow = typeof documents.$inferSelect
export type DocumentWithGroups = DocumentRow & { groupIds: string[] }

export async function listDocuments(workspaceId: string): Promise<DocumentWithGroups[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(desc(documents.createdAt))
  const dg = await db
    .select()
    .from(documentGroups)
    .where(eq(documentGroups.workspaceId, workspaceId))
  return rows.map((d) => ({
    ...d,
    groupIds: dg.filter((x) => x.documentId === d.id).map((x) => x.groupId),
  }))
}
