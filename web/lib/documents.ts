import 'server-only'
import { env } from '@/lib/env'
import { mapDocument, type DocumentRow } from '@/lib/engine'

export type DocumentWithGroups = DocumentRow

/** Who is asking. Required, never optional: an optional caller is exactly how
 *  the listings came to ignore the access model in the first place. */
export type Caller = { userId: string; role: 'owner' | 'member' }

export async function listDocuments(
  workspaceId: string,
  caller: Caller,
  folder?: string,
): Promise<DocumentWithGroups[]> {
  const qs = new URLSearchParams({
    workspace_id: workspaceId,
    user_id: caller.userId,
    role: caller.role,
  })
  if (folder) qs.set('folder', folder)
  const res = await fetch(`${env.ENGINE_BASE_URL}/documents?${qs}`, {
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`engine /documents responded ${res.status}`)
  const data = (await res.json()) as { documents: Parameters<typeof mapDocument>[0][] }
  return data.documents.map(mapDocument)
}

/** What download needs: the record plus where web put the bytes.
 *
 * `caller` is not optional here for the same reason it is not optional on
 * listDocuments — and it matters more, because this yields the whole file
 * rather than a filename. The engine returns 404, not 403, for a document the
 * caller may not see, so this returns null for both cases and the route must
 * not distinguish them either. */
export async function getDocument(
  workspaceId: string,
  caller: Caller,
  documentId: string,
): Promise<(DocumentWithGroups & { storageKey: string }) | null> {
  const qs = new URLSearchParams({
    workspace_id: workspaceId,
    user_id: caller.userId,
    role: caller.role,
  })
  const res = await fetch(
    `${env.ENGINE_BASE_URL}/documents/${encodeURIComponent(documentId)}?${qs}`,
    { headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET }, cache: 'no-store' },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`engine /documents/:id responded ${res.status}`)
  const { document } = (await res.json()) as {
    document: Parameters<typeof mapDocument>[0] & { storage_key: string }
  }
  return { ...mapDocument(document), storageKey: document.storage_key }
}

/** Delete the record and everything derived from it. Returns the storage key of
 *  what was deleted so the caller can drop the file too, or null if there was no
 *  such document in this workspace.
 *
 *  No `Caller`: this is owner-only and gated at the route
 *  (lib/control-plane-gates.test.ts). An owner has all_access, so a predicate
 *  here would be a no-op that implied a check the tier system already made. */
export async function deleteDocument(
  workspaceId: string,
  documentId: string,
): Promise<string | null> {
  const qs = new URLSearchParams({ workspace_id: workspaceId })
  const res = await fetch(
    `${env.ENGINE_BASE_URL}/documents/${encodeURIComponent(documentId)}?${qs}`,
    { method: 'DELETE', headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET } },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`engine DELETE /documents/:id responded ${res.status}`)
  const { storage_key } = (await res.json()) as { storage_key: string }
  return storage_key
}
