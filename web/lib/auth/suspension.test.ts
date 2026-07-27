/**
 * Suspending a firm must end its people's access on their NEXT REQUEST, not at
 * cookie expiry — the same standard already applied to blocking a single user.
 *
 * Deliberately a real-database test, not a mocked one: the thing being asserted
 * is that a specific SQL-backed check sits at the one choke point every
 * authenticated request funnels through. A mock of `db.query.*.findFirst` would
 * assert only that the code calls what the test told it to call. Gated on
 * DATABASE_URL and reported as skipped without it, matching the engine's
 * DB-backed tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { memberships, sessions, users, workspaces } from '@/lib/db/schema'
import { createSession, validateSessionToken } from '@/lib/auth/session-store'

const HAS_DB = !!process.env.DATABASE_URL

let wsId = ''
let userId = ''
let token = ''

describe.skipIf(!HAS_DB)('workspace suspension', () => {
  beforeAll(async () => {
    const [ws] = await db
      .insert(workspaces)
      .values({ name: 'Suspendable Firm', slug: `susp-${Date.now()}-${Math.random()}` })
      .returning()
    wsId = ws.id
    const [u] = await db
      .insert(users)
      .values({ email: `susp-${Date.now()}-${Math.random()}@test.local`, passwordHash: 'x' })
      .returning()
    userId = u.id
    await db.insert(memberships).values({ userId, workspaceId: wsId, role: 'member' })
    token = (await createSession(userId)).token
  })

  afterAll(async () => {
    if (wsId) await db.delete(workspaces).where(eq(workspaces.id, wsId))
    if (userId) await db.delete(users).where(eq(users.id, userId))
  })

  it('admits the user while the firm is active (non-vacuous)', async () => {
    const s = await validateSessionToken(token)
    expect(s).not.toBeNull()
    expect(s?.workspace.id).toBe(wsId)
    expect(s?.role).toBe('member')
  })

  it('refuses the session once the firm is suspended', async () => {
    await db.update(workspaces).set({ suspendedAt: new Date() }).where(eq(workspaces.id, wsId))
    expect(await validateSessionToken(token)).toBeNull()
  })

  it('admits again when the firm is resumed — suspension is reversible', async () => {
    await db.update(workspaces).set({ suspendedAt: null }).where(eq(workspaces.id, wsId))
    expect(await validateSessionToken(token)).not.toBeNull()
  })

  it('carries the role from the membership row', async () => {
    await db
      .update(memberships)
      .set({ role: 'owner' })
      .where(eq(memberships.userId, userId))
    expect((await validateSessionToken(token))?.role).toBe('owner')
    // Anything unrecognised must fall to the least privilege, never widen.
    await db
      .update(memberships)
      .set({ role: 'superuser-typo' })
      .where(eq(memberships.userId, userId))
    expect((await validateSessionToken(token))?.role).toBe('member')
    await db.update(memberships).set({ role: 'member' }).where(eq(memberships.userId, userId))
  })

  it('a session minted for a suspended firm is still refused', async () => {
    // Covers the race: suspension deletes existing sessions, but a login in
    // flight could create one immediately afterwards.
    await db.update(workspaces).set({ suspendedAt: new Date() }).where(eq(workspaces.id, wsId))
    const fresh = (await createSession(userId)).token
    expect(await validateSessionToken(fresh)).toBeNull()
    await db.update(workspaces).set({ suspendedAt: null }).where(eq(workspaces.id, wsId))
    await db.delete(sessions).where(eq(sessions.userId, userId))
  })
})
