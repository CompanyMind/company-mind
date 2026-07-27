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
