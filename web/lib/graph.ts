import 'server-only'
import { env } from '@/lib/env'

// The engine owns the Atlas graph (topics, findings, jobs). This is a thin
// client over its internal API — the single boundary that maps snake_case
// engine JSON to the camelCase shapes the web/React layer consumes.

async function engineFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env.ENGINE_BASE_URL}${path}`, {
    ...init,
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET, ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
}

async function engineJson(path: string, init?: RequestInit): Promise<unknown> {
  const res = await engineFetch(path, init)
  if (!res.ok) throw new Error(`engine ${path} responded ${res.status}`)
  return res.json()
}

// Builds the shared `workspace_id`/`user_id`/`role`[/`as_group`][/`kind`] query
// string used by every GET /graph* endpoint. `as_group` and `kind` are only
// included when set — the engine treats a present-but-empty value the same as
// absent, but omitting it keeps the URL (and test assertions) clean.
function graphQuery(ws: string, userId: string, role: string, asGroup?: string, kind?: string): string {
  const params = new URLSearchParams({ workspace_id: ws, user_id: userId, role })
  if (asGroup) params.set('as_group', asGroup)
  if (kind) params.set('kind', kind)
  return params.toString()
}

export type JobInfo = { id: string; status: string; error: string | null; computedAt: string | null }
export type TopicNode = { id: string; label: string; keywords: string[]; x: number; y: number; docCount: number }
export type Finding = {
  id: string
  kind: string
  documentId: string
  severity: number
  detail: Record<string, unknown>
  filename: string
}
export type DocNode = { id: string; filename: string; exposureScore: number; isOrphan: boolean; lastRetrievedAt: string | null }
export type DocGraphNode = {
  id: string
  filename: string
  department: string
  exposureScore: number
  isOrphan: boolean
  degree: number
}
export type DocGraphEdge = { source: string; target: string; weight: number }

type EngineJob = { id: string; status: string; error: string | null; computed_at: string | null }
type EngineTopic = { id: string; label: string; keywords: string[]; x: number; y: number; doc_count: number }
type EngineDocNode = {
  id: string
  filename: string
  exposure_score: number
  is_orphan: boolean
  last_retrieved_at: string | null
}
type EngineDocGraphNode = {
  id: string
  filename: string
  department: string
  exposure_score: number
  is_orphan: boolean
  degree: number
}
type EngineFinding = {
  id: string
  kind: string
  document_id: string
  severity: number
  detail: Record<string, unknown>
  filename: string
}

function mapJob(job: EngineJob | null): JobInfo | null {
  if (!job) return null
  return { id: job.id, status: job.status, error: job.error, computedAt: job.computed_at }
}

export async function getGraph(
  ws: string,
  userId: string,
  role: string,
  asGroup?: string,
): Promise<{ topics: TopicNode[]; job: JobInfo | null }> {
  const qs = graphQuery(ws, userId, role, asGroup)
  const data = (await engineJson(`/graph?${qs}`)) as { topics: EngineTopic[]; job: EngineJob | null }
  return {
    topics: data.topics.map((t) => ({
      id: t.id,
      label: t.label,
      keywords: t.keywords,
      x: t.x,
      y: t.y,
      docCount: t.doc_count,
    })),
    job: mapJob(data.job),
  }
}

export async function getTopic(
  ws: string,
  topicId: string,
  userId: string,
  role: string,
  asGroup?: string,
): Promise<{ nodes: DocNode[] }> {
  const qs = graphQuery(ws, userId, role, asGroup)
  const data = (await engineJson(`/graph/topic/${topicId}?${qs}`)) as { nodes: EngineDocNode[] }
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      filename: n.filename,
      exposureScore: n.exposure_score,
      isOrphan: n.is_orphan,
      lastRetrievedAt: n.last_retrieved_at,
    })),
  }
}

export async function getDocumentGraph(
  ws: string,
  userId: string,
  role: string,
  asGroup?: string,
): Promise<{ nodes: DocGraphNode[]; edges: DocGraphEdge[] }> {
  const qs = graphQuery(ws, userId, role, asGroup)
  const data = (await engineJson(`/graph/documents?${qs}`)) as {
    nodes: EngineDocGraphNode[]
    edges: DocGraphEdge[]
  }
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      filename: n.filename,
      department: n.department,
      exposureScore: n.exposure_score,
      isOrphan: n.is_orphan,
      degree: n.degree,
    })),
    edges: data.edges,
  }
}

export async function listFindings(
  ws: string,
  userId: string,
  role: string,
  asGroup?: string,
  kind?: string,
): Promise<Finding[]> {
  const qs = graphQuery(ws, userId, role, asGroup, kind)
  const data = (await engineJson(`/graph/findings?${qs}`)) as { findings: EngineFinding[] }
  return data.findings.map((f) => ({
    id: f.id,
    kind: f.kind,
    documentId: f.document_id,
    severity: f.severity,
    detail: f.detail ?? {},
    filename: f.filename,
  }))
}

export async function rebuildGraph(ws: string): Promise<JobInfo | null> {
  const data = (await engineJson('/graph/rebuild', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: ws }),
  })) as { job: EngineJob | null }
  return mapJob(data.job)
}

export async function dismissFinding(ws: string, id: string): Promise<boolean> {
  const res = await engineFetch(`/graph/findings/${id}/dismiss`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: ws }),
  })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`engine POST /graph/findings/${id}/dismiss responded ${res.status}`)
  return true
}
