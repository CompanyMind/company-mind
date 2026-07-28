import 'server-only'
import { env } from '@/lib/env'
import { enginePath, seg } from '@/lib/engine-url'

// The engine owns the knowledge tables (groups, group_members, document_groups).
// These are thin clients over its internal API.

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

export type GroupRow = {
  id: string
  name: string
  isDefault: boolean
  memberUserIds: string[]
  /** How many documents this group opens up — the "what" half of "who can see
   *  what". 0 for a group just created, which is why it is not optional. */
  documentCount: number
}

type EngineGroup = {
  id: string
  name: string
  is_default: boolean
  member_user_ids?: string[]
  document_count?: number
}

export async function listGroups(workspaceId: string): Promise<GroupRow[]> {
  const data = (await engineJson(`/groups?workspace_id=${seg(workspaceId)}`)) as { groups: EngineGroup[] }
  return data.groups.map((g) => ({
    id: g.id,
    name: g.name,
    isDefault: g.is_default,
    memberUserIds: g.member_user_ids ?? [],
    documentCount: g.document_count ?? 0,
  }))
}

export async function createGroup(
  workspaceId: string,
  name: string,
): Promise<GroupRow | 'conflict'> {
  const res = await engineFetch('/groups', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  })
  if (res.status === 409) return 'conflict'
  if (!res.ok) throw new Error(`engine POST /groups responded ${res.status}`)
  const { group } = (await res.json()) as { group: EngineGroup }
  return {
    id: group.id,
    name: group.name,
    isDefault: group.is_default,
    memberUserIds: [],
    documentCount: 0,
  }
}

export async function renameGroup(
  workspaceId: string,
  id: string,
  name: string,
): Promise<boolean> {
  const res = await engineFetch(enginePath`/groups/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, name }),
  })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`engine PATCH /groups responded ${res.status}`)
  return true
}

export async function deleteGroup(
  workspaceId: string,
  id: string,
): Promise<'ok' | 'notfound' | 'default'> {
  const res = await engineFetch(`${enginePath`/groups/${id}`}?workspace_id=${seg(workspaceId)}`, { method: 'DELETE' })
  if (res.status === 404) return 'notfound'
  if (res.status === 400) return 'default'
  if (!res.ok) throw new Error(`engine DELETE /groups responded ${res.status}`)
  return 'ok'
}

export async function setGroupMembers(
  id: string,
  workspaceId: string,
  userIds: string[],
): Promise<void> {
  await engineJson(enginePath`/groups/${id}/members`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, user_ids: userIds }),
  })
}

export async function setDocumentGroups(
  documentId: string,
  workspaceId: string,
  groupIds: string[],
): Promise<void> {
  await engineJson(enginePath`/documents/${documentId}/groups`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, group_ids: groupIds }),
  })
}

