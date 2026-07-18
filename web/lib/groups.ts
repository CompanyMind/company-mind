import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { groups, groupMembers, documentGroups } from '@/lib/db/schema'

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
