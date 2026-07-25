import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions, users, workspaces, memberships } from '@/lib/db/schema'
import { generateToken, hashToken, SESSION_TTL_MS } from './session'

export type User = typeof users.$inferSelect
export type Workspace = typeof workspaces.$inferSelect

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ token: string; expires: Date }> {
  const token = generateToken()
  const expires = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: expires,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  })
  return { token, expires }
}

export async function validateSessionToken(
  token: string,
): Promise<{ user: User; workspace: Workspace } | null> {
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, hashToken(token)),
  })
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.id))
    return null
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) })
  if (!user) return null
  // Blocking is enforced HERE because every authenticated request already
  // funnels through this function — getCurrentUser, the ask route, the source
  // viewer, every API route. Checking anywhere else would leave a surface open.
  // The session rows are deleted at block time too; this is the belt to that
  // braces, and it also covers a session minted in a race with the block.
  if (user.blockedAt) return null
  // v1: one workspace per user via their first membership.
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  })
  if (!membership) return null
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, membership.workspaceId),
  })
  if (!workspace) return null
  return { user, workspace }
}

export async function revokeSessionToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}
