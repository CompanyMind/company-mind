import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chunks, documents, documentGroups } from '@/lib/db/schema'
import type { Access } from '@/lib/groups'

export type SourceView = {
  filename: string
  page: number | null
  charStart: number
  charEnd: number
  text: string
}

// Resolve a chunk to a viewable, HIGHLIGHTED source — but only if the caller is
// allowed to see the document (owner bypass, or the document's groups intersect
// the caller's). Returns null when missing or not permitted (no leak either way).
export async function getSource(
  chunkId: string,
  workspaceId: string,
  access: Access,
): Promise<SourceView | null> {
  const chunk = await db.query.chunks.findFirst({
    where: and(eq(chunks.id, chunkId), eq(chunks.workspaceId, workspaceId)),
  })
  if (!chunk) return null
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, chunk.documentId), eq(documents.workspaceId, workspaceId)),
  })
  if (!doc) return null

  if (!access.allAccess) {
    const dg = await db
      .select({ groupId: documentGroups.groupId })
      .from(documentGroups)
      .where(eq(documentGroups.documentId, doc.id))
    const allowed = dg.some((g) => access.groupIds.includes(g.groupId))
    if (!allowed) return null
  }

  const full = doc.extractedText
  if (full && chunk.charStart != null && chunk.charEnd != null && chunk.charEnd <= full.length) {
    return {
      filename: doc.filename,
      page: chunk.page,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      text: full,
    }
  }
  // Fallback for documents ingested before extracted_text existed: show the
  // chunk itself, fully highlighted.
  return {
    filename: doc.filename,
    page: chunk.page,
    charStart: 0,
    charEnd: chunk.text.length,
    text: chunk.text,
  }
}
