import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions, users, workspaces, memberships } from '@/lib/db/schema'
import { generateToken, hashToken, SESSION_TTL_MS } from './session'

export type User = typeof users.$inferSelect
export type Workspace = typeof workspaces.$inferSelect
export type Role = 'owner' | 'member'

/** What every authenticated request resolves to. `role` is carried here because
 *  the membership row is already fetched to find the workspace — every surface
 *  that needs the role would otherwise re-query for it. */
export type Session = { user: User; workspace: Workspace; role: Role }

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

export async function validateSessionToken(token: string): Promise<Session | null> {
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
  // Suspension sits beside blocking, at the same choke point and for the same
  // reason: setting a flag the request path never reads would let a suspended
  // firm keep working until every cookie expired.
  if (workspace.suspendedAt) return null
  // Anything that is not exactly 'owner' is a member. Never widen here: an
  // unrecognised role string must fall to the least privilege, not the most.
  return { user, workspace, role: membership.role === 'owner' ? 'owner' : 'member' }
}

/**
 * The session's user WITHOUT requiring a workspace membership.
 *
 * Only the platform tier uses this. A platform operator in `hosted` mode owns no
 * firm, and `validateSessionToken` returns null when there is no membership row —
 * so without this the operator could not log in at all. Keeping it separate means
 * `validateSessionToken` still guarantees a non-null workspace to all 38 callers
 * of `getCurrentUser()`, instead of making `workspace` nullable everywhere for
 * the sake of one screen.
 *
 * Blocking and expiry are checked exactly as above. There is no workspace, so
 * there is no workspace suspension to check — the platform operator is not a
 * member of any firm and cannot be suspended along with one.
 */
export async function validateSessionUserOnly(token: string): Promise<User | null> {
  const row = await db.query.sessions.findFirst({ where: eq(sessions.tokenHash, hashToken(token)) })
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.id))
    return null
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) })
  if (!user) return null
  if (user.blockedAt) return null
  return user
}

export async function revokeSessionToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}
