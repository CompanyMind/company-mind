import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { documents } from '@/lib/db/schema'

export type DocumentRow = typeof documents.$inferSelect

export function listDocuments(workspaceId: string): Promise<DocumentRow[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(desc(documents.createdAt))
}
