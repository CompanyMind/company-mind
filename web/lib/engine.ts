import 'server-only'
import { env } from '@/lib/env'

export type DocumentRow = {
  id: string
  filename: string
  mime: string
  bytes: number
  status: string
  error: string | null
  createdAt: string | null
  groupIds: string[]
}

type EngineDoc = {
  id: string
  filename: string
  mime: string
  bytes: number
  status: string
  error: string | null
  created_at: string | null
  group_ids?: string[]
}

export function mapDocument(d: EngineDoc): DocumentRow {
  return {
    id: d.id,
    filename: d.filename,
    mime: d.mime,
    bytes: d.bytes,
    status: d.status,
    error: d.error,
    createdAt: d.created_at,
    groupIds: d.group_ids ?? [],
  }
}

// Upload an already-stored file to the engine, which creates the document +
// ingestion job, defaults it to Everyone, and processes it. Returns the new doc.
export async function uploadDocument(opts: {
  workspaceId: string
  filename: string
  mime: string
  bytes: number
  storageKey: string
  data: Buffer
}): Promise<DocumentRow> {
  const form = new FormData()
  form.set('workspace_id', opts.workspaceId)
  form.set('filename', opts.filename)
  form.set('mime', opts.mime)
  form.set('storage_key', opts.storageKey)
  form.set('bytes', String(opts.bytes))
  form.set('file', new Blob([new Uint8Array(opts.data)], { type: opts.mime }), opts.filename)
  const res = await fetch(`${env.ENGINE_BASE_URL}/ingest`, {
    method: 'POST',
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    body: form,
  })
  if (!res.ok) throw new Error(`engine /ingest responded ${res.status}`)
  const { document } = (await res.json()) as { document: EngineDoc }
  return mapDocument(document)
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
  userId: string,
  role: string,
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
      user_id: userId, // engine resolves this principal's access + writes the audit row
      role,
    }),
  })
  if (!res.ok) throw new Error(`engine /ask responded ${res.status}`)
  return res.json()
}

// Best-effort chat title from the first message. A title failure must never
// break a turn, so any engine error (network, non-2xx, bad body) falls back
// to a truncated version of the text instead of throwing.
function fallbackTitle(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= 48) return trimmed
  const cut = trimmed.slice(0, 48)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()
}

export async function generateTitle(text: string): Promise<string> {
  try {
    const res = await fetch(`${env.ENGINE_BASE_URL}/title`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-engine-secret': env.ENGINE_INTERNAL_SECRET,
      },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return fallbackTitle(text)
    const data = (await res.json()) as { title?: string }
    return data.title?.trim() || fallbackTitle(text)
  } catch {
    return fallbackTitle(text)
  }
}
