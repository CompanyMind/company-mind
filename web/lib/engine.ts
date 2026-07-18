import 'server-only'
import { env } from '@/lib/env'

export async function ingestDocument(opts: {
  documentId: string
  workspaceId: string
  filename: string
  mime: string
  data: Buffer
}): Promise<void> {
  const form = new FormData()
  form.set('document_id', opts.documentId)
  form.set('workspace_id', opts.workspaceId)
  form.set('file', new Blob([new Uint8Array(opts.data)], { type: opts.mime }), opts.filename)
  const res = await fetch(`${env.ENGINE_BASE_URL}/ingest`, {
    method: 'POST',
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    body: form,
  })
  if (!res.ok) throw new Error(`engine /ingest responded ${res.status}`)
}

export type EngineCitation = {
  marker: number
  chunk_id: string
  document_id: string
  filename: string
  page: number | null
  snippet: string
}
export type EngineAnswer = {
  answer: string
  insufficient: boolean
  retrieved_chunk_ids: string[]
  citations: EngineCitation[]
}

export async function askEngine(
  workspaceId: string,
  question: string,
  access: { groupIds: string[]; allAccess: boolean },
): Promise<EngineAnswer> {
  const res = await fetch(`${env.ENGINE_BASE_URL}/ask`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-engine-secret': env.ENGINE_INTERNAL_SECRET,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      question,
      group_ids: access.groupIds,
      all_access: access.allAccess,
    }),
  })
  if (!res.ok) throw new Error(`engine /ask responded ${res.status}`)
  return res.json()
}
