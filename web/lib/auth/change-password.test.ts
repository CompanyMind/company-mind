/**
 * Changing your own password.
 *
 * This exists because the three-tier model makes admin-created accounts the norm:
 * a firm's owner generates a temp password for each member of staff. Without a
 * change flow the owner knows every employee's password forever, which destroys
 * any per-user attribution the audit trail claims — and there is no way to
 * recover from a leaked temp password short of the admin issuing another one.
 *
 * Real database, for the same reason as suspension.test.ts: the load-bearing
 * assertions are that the stored hash actually rotates and that OTHER sessions
 * are actually deleted while the caller's own survives.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions, users, workspaces, memberships } from '@/lib/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession, validateSessionToken } from '@/lib/auth/session-store'
import { changePassword, MIN_PASSWORD_LENGTH } from '@/lib/auth/change-password'

const HAS_DB = !!process.env.DATABASE_URL
const ORIGINAL = 'original-temp-password-1'
const REPLACEMENT = 'a-much-better-choice-2'

let wsId = ''
let userId = ''

describe.skipIf(!HAS_DB)('changePassword', () => {
  beforeAll(async () => {
    const [ws] = await db
      .insert(workspaces)
      .values({ name: 'PW Firm', slug: `pw-${Date.now()}-${Math.random()}` })
      .returning()
    wsId = ws.id
    const [u] = await db
      .insert(users)
      .values({
        email: `pw-${Date.now()}-${Math.random()}@test.local`,
        passwordHash: await hashPassword(ORIGINAL),
        mustChangePassword: true,
      })
      .returning()
    userId = u.id
    await db.insert(memberships).values({ userId, workspaceId: wsId, role: 'member' })
  })

  afterAll(async () => {
    if (wsId) await db.delete(workspaces).where(eq(workspaces.id, wsId))
    if (userId) await db.delete(users).where(eq(users.id, userId))
  })

  it('rejects a wrong current password without changing anything', async () => {
    const res = await changePassword({
      userId,
      currentPassword: 'not-it',
      newPassword: REPLACEMENT,
    })
    expect(res).toBe('wrong-password')
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) })
    expect(await verifyPassword(u!.passwordHash, ORIGINAL)).toBe(true)
    expect(u!.mustChangePassword).toBe(true)
  })

  it('rejects a new password that is too short', async () => {
    const res = await changePassword({
      userId,
      currentPassword: ORIGINAL,
      newPassword: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
    })
    expect(res).toBe('too-short')
  })

  it('rejects reusing the current password', async () => {
    const res = await changePassword({
      userId,
      currentPassword: ORIGINAL,
      newPassword: ORIGINAL,
    })
    expect(res).toBe('same-password')
  })

  it('rotates the hash, clears mustChangePassword, and kills other sessions only', async () => {
    const mine = (await createSession(userId)).token
    const otherA = (await createSession(userId)).token
    const otherB = (await createSession(userId)).token
    expect(await validateSessionToken(otherA)).not.toBeNull() // non-vacuous

    const res = await changePassword({
      userId,
      currentPassword: ORIGINAL,
      newPassword: REPLACEMENT,
      keepSessionToken: mine,
    })
    expect(res).toBe('ok')

    const u = await db.query.users.findFirst({ where: eq(users.id, userId) })
    expect(await verifyPassword(u!.passwordHash, REPLACEMENT)).toBe(true)
    expect(await verifyPassword(u!.passwordHash, ORIGINAL)).toBe(false)
    expect(u!.mustChangePassword).toBe(false)

    // The caller stays signed in; everyone else holding a cookie is evicted.
    expect(await validateSessionToken(mine)).not.toBeNull()
    expect(await validateSessionToken(otherA)).toBeNull()
    expect(await validateSessionToken(otherB)).toBeNull()

    await db.delete(sessions).where(eq(sessions.userId, userId))
  })
})
