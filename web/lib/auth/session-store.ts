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
 *  that needs the role would otherwise re-query for it. `sessionId` rides along
 *  for the same reason: the session row is already read below, and the active
 *  sessions list needs it to mark which row is "this device". */
export type Session = { sessionId: string; user: User; workspace: Workspace; role: Role }

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

/**
 * Resolve a session cookie to its principal.
 *
 * ONE query, not four. This used to be four sequential `findFirst` calls —
 * sessions, then users, then memberships, then workspaces — each awaiting the
 * last, on every authenticated request AND every server render of every page.
 * They are all equality joins on primary keys, so the database can do in one
 * round-trip what four awaits did in four.
 *
 * The guards are unchanged and stay in the same order, because each one means
 * something different and they are the reason this function is a choke point:
 * expiry (with the row deleted on the way out), blocking, membership, and
 * workspace suspension. `memberships.user_id` is uniquely indexed
 * (`memberships_one_workspace_per_user`), so the join cannot fan out — one user
 * has exactly one workspace, which is the invariant the old `findFirst` with no
 * ORDER BY was quietly depending on anyway.
 */
export async function validateSessionToken(token: string): Promise<Session | null> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: users,
      workspace: workspaces,
      role: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1)

  // No row means: no such session, OR the user/membership/workspace it points
  // at is gone. All four are "not signed in", and none of them is worth
  // distinguishing to the caller.
  if (!row) return null

  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId))
    return null
  }
  // Blocking is enforced HERE because every authenticated request already
  // funnels through this function — getCurrentUser, the ask route, the source
  // viewer, every API route. Checking anywhere else would leave a surface open.
  // The session rows are deleted at block time too; this is the belt to that
  // braces, and it also covers a session minted in a race with the block.
  if (row.user.blockedAt) return null
  // Suspension sits beside blocking, at the same choke point and for the same
  // reason: setting a flag the request path never reads would let a suspended
  // firm keep working until every cookie expired.
  if (row.workspace.suspendedAt) return null
  // Anything that is not exactly 'owner' is a member. Never widen here: an
  // unrecognised role string must fall to the least privilege, not the most.
  return {
    sessionId: row.sessionId,
    user: row.user,
    workspace: row.workspace,
    role: row.role === 'owner' ? 'owner' : 'member',
  }
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
