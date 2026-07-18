import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { groups, groupMembers, documentGroups, memberships } from '@/lib/db/schema'

export async function getEveryoneGroup(workspaceId: string): Promise<string> {
  const existing = await db.query.groups.findFirst({
    where: and(eq(groups.workspaceId, workspaceId), eq(groups.isDefault, true)),
  })
  if (existing) return existing.id
  const [g] = await db
    .insert(groups)
    .values({ workspaceId, name: 'Everyone', slug: 'everyone', isDefault: true })
    .returning()
  return g.id
}

export type Access = { groupIds: string[]; allAccess: boolean }

// The asking person's access: owners bypass the filter; everyone else is
// scoped to the Everyone group plus any groups they're a member of.
export async function resolveAccess(
  userId: string,
  workspaceId: string,
  role: string,
): Promise<Access> {
  if (role === 'owner') return { groupIds: [], allAccess: true }
  const everyone = await getEveryoneGroup(workspaceId)
  const rows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(and(eq(groupMembers.workspaceId, workspaceId), eq(groupMembers.userId, userId)))
  const ids = new Set<string>([everyone, ...rows.map((r) => r.groupId)])
  return { groupIds: [...ids], allAccess: false }
}

export async function listGroups(workspaceId: string) {
  return db.select().from(groups).where(eq(groups.workspaceId, workspaceId))
}

export async function groupMemberUserIds(workspaceId: string): Promise<Map<string, string[]>> {
  const rows = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.workspaceId, workspaceId))
  const map = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.userId) continue
    map.set(r.groupId, [...(map.get(r.groupId) ?? []), r.userId])
  }
  return map
}

// Replace a Telegram identity's group membership (the admin-assigned groups).
export async function setTelegramLinkGroups(
  linkId: string,
  workspaceId: string,
  groupIds: string[],
): Promise<void> {
  await db
    .delete(groupMembers)
    .where(
      and(eq(groupMembers.workspaceId, workspaceId), eq(groupMembers.telegramLinkId, linkId)),
    )
  if (groupIds.length) {
    const valid = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.workspaceId, workspaceId), inArray(groups.id, groupIds)))
    if (valid.length) {
      await db
        .insert(groupMembers)
        .values(valid.map((g) => ({ workspaceId, groupId: g.id, telegramLinkId: linkId })))
    }
  }
}

// Replace a group's web-user membership. Only users who belong to the workspace
// are added.
export async function setGroupMembers(
  groupId: string,
  workspaceId: string,
  userIds: string[],
): Promise<void> {
  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.workspaceId, workspaceId)))
  if (userIds.length) {
    const valid = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, workspaceId), inArray(memberships.userId, userIds)))
    if (valid.length) {
      await db
        .insert(groupMembers)
        .values(valid.map((v) => ({ workspaceId, groupId, userId: v.userId })))
    }
  }
}

export async function documentGroupIds(documentId: string, workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: documentGroups.groupId })
    .from(documentGroups)
    .where(
      and(eq(documentGroups.documentId, documentId), eq(documentGroups.workspaceId, workspaceId)),
    )
  return rows.map((r) => r.groupId)
}

export async function setDocumentGroups(
  documentId: string,
  workspaceId: string,
  groupIds: string[],
): Promise<void> {
  await db
    .delete(documentGroups)
    .where(
      and(eq(documentGroups.documentId, documentId), eq(documentGroups.workspaceId, workspaceId)),
    )
  if (groupIds.length) {
    // Only groups that actually belong to this workspace.
    const valid = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.workspaceId, workspaceId), inArray(groups.id, groupIds)))
    if (valid.length) {
      await db
        .insert(documentGroups)
        .values(valid.map((g) => ({ documentId, workspaceId, groupId: g.id })))
    }
  }
}
