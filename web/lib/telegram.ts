import 'server-only'
import { eq } from 'drizzle-orm'
import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { telegramBots, telegramLinks, groupMembers } from '@/lib/db/schema'

export async function connectTelegram(
  workspaceId: string,
  token: string,
): Promise<{ username: string }> {
  const res = await fetch(`${env.ENGINE_BASE_URL}/telegram/connect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    body: JSON.stringify({ workspace_id: workspaceId, token }),
  })
  if (!res.ok) throw new Error(`engine /telegram/connect responded ${res.status}`)
  return res.json()
}

export async function disconnectTelegram(workspaceId: string): Promise<void> {
  const res = await fetch(`${env.ENGINE_BASE_URL}/telegram/disconnect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    body: JSON.stringify({ workspace_id: workspaceId }),
  })
  if (!res.ok) throw new Error(`engine /telegram/disconnect responded ${res.status}`)
}

export async function getTelegramStatus(workspaceId: string) {
  const bot = await db.query.telegramBots.findFirst({
    where: eq(telegramBots.workspaceId, workspaceId),
  })
  return bot ? { connected: true, username: bot.botUsername } : { connected: false, username: null }
}

export type LinkRow = {
  id: string
  telegramUsername: string | null
  displayName: string | null
  status: string
  groupIds: string[]
}

export async function listLinks(workspaceId: string): Promise<LinkRow[]> {
  const links = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.workspaceId, workspaceId))
  const gm = await db.select().from(groupMembers).where(eq(groupMembers.workspaceId, workspaceId))
  return links.map((l) => ({
    id: l.id,
    telegramUsername: l.telegramUsername,
    displayName: l.displayName,
    status: l.status,
    groupIds: gm.filter((m) => m.telegramLinkId === l.id).map((m) => m.groupId),
  }))
}
