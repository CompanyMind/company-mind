import 'server-only'
import { env } from '@/lib/env'
import { enginePath, seg } from '@/lib/engine-url'

// All Telegram state lives in the engine's knowledge DB. These are thin clients.
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

export async function connectTelegram(
  workspaceId: string,
  token: string,
): Promise<{ username: string }> {
  const res = await engineFetch('/telegram/connect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, token }),
  })
  if (!res.ok) throw new Error(`engine /telegram/connect responded ${res.status}`)
  return res.json()
}

export async function disconnectTelegram(workspaceId: string): Promise<void> {
  await engineJson('/telegram/disconnect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId }),
  })
}

export async function getTelegramStatus(
  workspaceId: string,
): Promise<{ connected: boolean; username: string | null }> {
  return engineJson(`/telegram/status?workspace_id=${seg(workspaceId)}`) as Promise<{
    connected: boolean
    username: string | null
  }>
}

export type LinkRow = {
  id: string
  telegramUsername: string | null
  displayName: string | null
  status: string
  groupIds: string[]
}

type EngineLink = {
  id: string
  telegram_username: string | null
  display_name: string | null
  status: string
  group_ids?: string[]
}

export async function listLinks(workspaceId: string): Promise<LinkRow[]> {
  const data = (await engineJson(`/telegram/links?workspace_id=${seg(workspaceId)}`)) as {
    links: EngineLink[]
  }
  return data.links.map((l) => ({
    id: l.id,
    telegramUsername: l.telegram_username,
    displayName: l.display_name,
    status: l.status,
    groupIds: l.group_ids ?? [],
  }))
}

export async function setLinkStatus(
  id: string,
  workspaceId: string,
  action: string,
): Promise<'ok' | 'notfound' | 'unknown'> {
  const res = await engineFetch(enginePath`/telegram/links/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, action }),
  })
  if (res.status === 404) return 'notfound'
  if (res.status === 400) return 'unknown'
  if (!res.ok) throw new Error(`engine POST /telegram/links responded ${res.status}`)
  return 'ok'
}

export async function setTelegramLinkGroups(
  id: string,
  workspaceId: string,
  groupIds: string[],
): Promise<void> {
  await engineJson(enginePath`/telegram/links/${id}/groups`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, group_ids: groupIds }),
  })
}
