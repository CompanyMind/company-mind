/**
 * The guards inside `validateSessionToken`, held against a real database.
 *
 * `suspension.test.ts` already covers workspace suspension and role narrowing.
 * This covers the rest, because the four sequential `findFirst` calls were
 * collapsed into one join (AUDIT.md B4) and every one of these branches is a
 * place where a join can silently change behaviour: an `innerJoin` that should
 * have been a `leftJoin` turns "no membership" from a deliberate refusal into
 * an accidental one that happens to look the same, and an expiry check that
 * stops deleting the row leaks session rows forever.
 *
 * Real DB, not mocks, for the same reason suspension.test.ts gives: a mocked
 * `db.query.*` asserts only that the code calls what the test told it to call.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { memberships, sessions, users, workspaces } from '@/lib/db/schema'
import { createSession, validateSessionToken, revokeSessionToken } from '@/lib/auth/session-store'
import { hashToken } from '@/lib/auth/session'

const HAS_DB = !!process.env.DATABASE_URL
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

let wsId = ''
let userId = ''
let strayUserId = ''

describe.skipIf(!HAS_DB)('validateSessionToken guards', () => {
  beforeAll(async () => {
    const [ws] = await db
      .insert(workspaces)
      .values({ name: 'Guarded Firm', slug: `guard-${uniq()}` })
      .returning()
    wsId = ws.id
    const [u] = await db
      .insert(users)
      .values({ email: `guard-${uniq()}@test.local`, passwordHash: 'x' })
      .returning()
    userId = u.id
    await db.insert(memberships).values({ userId, workspaceId: wsId, role: 'member' })

    // A user with NO membership — the platform-operator shape.
    const [stray] = await db
      .insert(users)
      .values({ email: `stray-${uniq()}@test.local`, passwordHash: 'x' })
      .returning()
    strayUserId = stray.id
  })

  afterAll(async () => {
    if (wsId) await db.delete(workspaces).where(eq(workspaces.id, wsId))
    if (userId) await db.delete(users).where(eq(users.id, userId))
    if (strayUserId) await db.delete(users).where(eq(users.id, strayUserId))
  })

  it('returns the full principal for a live session (non-vacuous)', async () => {
    const { token } = await createSession(userId)
    const s = await validateSessionToken(token)
    expect(s).not.toBeNull()
    expect(s!.user.id).toBe(userId)
    expect(s!.workspace.id).toBe(wsId)
    expect(s!.role).toBe('member')
    // sessionId must be the session's own row id, not the user's — the active
    // devices list uses it to mark "this device".
    expect(s!.sessionId).not.toBe(userId)
    const [row] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
    expect(s!.sessionId).toBe(row.id)
    await revokeSessionToken(token)
  })

  it('refuses an unknown token', async () => {
    expect(await validateSessionToken('not-a-real-token')).toBeNull()
  })

  it('refuses an expired session AND deletes its row', async () => {
    const { token } = await createSession(userId)
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.tokenHash, hashToken(token)))

    expect(await validateSessionToken(token)).toBeNull()

    const left = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
    expect(left).toHaveLength(0)
  })

  it('refuses a blocked user', async () => {
    const { token } = await createSession(userId)
    await db.update(users).set({ blockedAt: new Date() }).where(eq(users.id, userId))
    expect(await validateSessionToken(token)).toBeNull()

    await db.update(users).set({ blockedAt: null }).where(eq(users.id, userId))
    expect(await validateSessionToken(token)).not.toBeNull()
    await revokeSessionToken(token)
  })

  it('refuses a user with no membership — workspace is never null here', async () => {
    // This is what keeps `workspace` non-nullable for every getCurrentUser()
    // caller. The platform operator uses validateSessionUserOnly instead.
    const { token } = await createSession(strayUserId)
    expect(await validateSessionToken(token)).toBeNull()
    await revokeSessionToken(token)
  })

  it('does not leak another user session into this one', async () => {
    const a = await createSession(userId)
    const b = await createSession(userId)
    const sa = await validateSessionToken(a.token)
    const sb = await validateSessionToken(b.token)
    expect(sa!.sessionId).not.toBe(sb!.sessionId)
    await db.delete(sessions).where(eq(sessions.userId, userId))
  })

  it('leaves exactly one row per membership — the join cannot fan out', async () => {
    // memberships.user_id is uniquely indexed, which is what makes a one-row
    // join safe. If that index were ever dropped, this is where it shows up.
    const rows = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, wsId)))
    expect(rows).toHaveLength(1)
  })
})
