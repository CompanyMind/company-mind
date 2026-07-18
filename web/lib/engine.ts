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
