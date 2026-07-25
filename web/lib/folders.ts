import 'server-only'
import { env } from '@/lib/env'

// The engine owns the knowledge tables. These are thin clients over its internal API.

async function engineFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env.ENGINE_BASE_URL}${path}`, {
    ...init,
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET, ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
}

export type FolderRow = {
  id: string
  name: string
  origin: 'manual' | 'ai'
  reviewed: boolean
  keywords: string[]
  documentCount: number
}

type EngineFolder = {
  id: string
  name: string
  origin: string
  reviewed: boolean
  keywords?: string[]
  document_count: number
}

function mapFolder(f: EngineFolder): FolderRow {
  return {
    id: f.id,
    name: f.name,
    origin: f.origin === 'ai' ? 'ai' : 'manual',
    reviewed: f.reviewed,
    keywords: f.keywords ?? [],
    documentCount: f.document_count,
  }
}

export async function listFolders(
  workspaceId: string,
): Promise<{ folders: FolderRow[]; unfiledCount: number }> {
  const res = await engineFetch(`/folders?workspace_id=${workspaceId}`)
  if (!res.ok) throw new Error(`engine /folders responded ${res.status}`)
  const data = (await res.json()) as { folders: EngineFolder[]; unfiled_count: number }
  return { folders: data.folders.map(mapFolder), unfiledCount: data.unfiled_count }
}

export async function createFolder(
  workspaceId: string,
  name: string,
): Promise<FolderRow | 'conflict'> {
  const res = await engineFetch('/folders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  })
  if (res.status === 409) return 'conflict'
  if (!res.ok) throw new Error(`engine POST /folders responded ${res.status}`)
  const { folder } = (await res.json()) as { folder: EngineFolder }
  return mapFolder(folder)
}

export async function renameFolder(
  workspaceId: string,
  id: string,
  name: string,
): Promise<'ok' | 'notfound' | 'conflict'> {
  const res = await engineFetch(`/folders/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  })
  if (res.status === 404) return 'notfound'
  if (res.status === 409) return 'conflict'
  if (!res.ok) throw new Error(`engine PATCH /folders responded ${res.status}`)
  return 'ok'
}

export async function deleteFolder(workspaceId: string, id: string): Promise<boolean> {
  const res = await engineFetch(`/folders/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`engine DELETE /folders responded ${res.status}`)
  return true
}

export async function setDocumentFolder(
  documentId: string,
  workspaceId: string,
  folderId: string | null,
): Promise<boolean> {
  const res = await engineFetch(`/documents/${documentId}/folder`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, folder_id: folderId }),
  })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`engine PUT /documents/folder responded ${res.status}`)
  return true
}
