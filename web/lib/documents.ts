import 'server-only'
import { env } from '@/lib/env'
import { mapDocument, type DocumentRow } from '@/lib/engine'

export type DocumentWithGroups = DocumentRow

export async function listDocuments(workspaceId: string): Promise<DocumentWithGroups[]> {
  const res = await fetch(`${env.ENGINE_BASE_URL}/documents?workspace_id=${workspaceId}`, {
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`engine /documents responded ${res.status}`)
  const data = (await res.json()) as { documents: Parameters<typeof mapDocument>[0][] }
  return data.documents.map(mapDocument)
}
