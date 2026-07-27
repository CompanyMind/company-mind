/**
 * An owner of firm A must not be able to touch firm B.
 *
 * This is the one hole the three-tier split could have opened. The old
 * `createUser` took `workspaceId` as a parameter and `POST /api/admin/users`
 * read it straight from the request body; a naive port of that code into an
 * owner-facing route would have let any firm owner create accounts in — and
 * list the staff of — every other firm on the platform.
 *
 * The rule: the workspace comes from the SESSION, and a body value is ignored
 * outright rather than validated. There is no legitimate reason for a client to
 * name a workspace, so there is nothing to check.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { memberships, users, workspaces } from '@/lib/db/schema'
import { createSession, validateSessionToken } from '@/lib/auth/session-store'
import {
  createPerson,
  listPeople,
  setPersonBlocked,
  resetPersonPassword,
} from '@/lib/people'

const HAS_DB = !!process.env.DATABASE_URL
const madeWs: string[] = []
const madeUsers: string[] = []

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function firm(label: string) {
  const [ws] = await db
    .insert(workspaces)
    .values({ name: `${label} ${uniq()}`, slug: `${label}-${uniq()}` })
    .returning()
  madeWs.push(ws.id)
  const [owner] = await db
    .insert(users)
    .values({ email: `owner-${uniq()}@${label}.test`, passwordHash: 'x' })
    .returning()
  madeUsers.push(owner.id)
  await db.insert(memberships).values({ userId: owner.id, workspaceId: ws.id, role: 'owner' })
  return { wsId: ws.id, ownerId: owner.id }
}

afterEach(async () => {
  if (!HAS_DB) return
  if (madeWs.length) await db.delete(workspaces).where(inArray(workspaces.id, madeWs))
  if (madeUsers.length) await db.delete(users).where(inArray(users.id, madeUsers))
  madeWs.length = 0
  madeUsers.length = 0
})

describe.skipIf(!HAS_DB)('people are scoped to one firm', () => {
  it('creates the account in the caller’s own firm', async () => {
    const a = await firm('alpha')
    const res = await createPerson({
      workspaceId: a.wsId,
      email: `staff-${uniq()}@alpha.test`,
      name: 'Staff',
      role: 'member',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    madeUsers.push(res.userId)

    const mem = await db.query.memberships.findFirst({ where: eq(memberships.userId, res.userId) })
    expect(mem?.workspaceId).toBe(a.wsId)
    // Admin-created, so they must choose their own password, and they can never
    // be a platform operator.
    const u = await db.query.users.findFirst({ where: eq(users.id, res.userId) })
    expect(u?.mustChangePassword).toBe(true)
    expect(u?.isSuperAdmin).toBe(false)
  })

  it('lists only the caller’s own firm, never the other one', async () => {
    const a = await firm('alpha')
    const b = await firm('beta')

    const inA = await listPeople(a.wsId)
    const inB = await listPeople(b.wsId)

    // Non-vacuous: each owner IS visible in their own firm...
    expect(inA.map((p) => p.id)).toContain(a.ownerId)
    expect(inB.map((p) => p.id)).toContain(b.ownerId)
    // ...and never in the other's.
    expect(inA.map((p) => p.id)).not.toContain(b.ownerId)
    expect(inB.map((p) => p.id)).not.toContain(a.ownerId)
    expect(inA).toHaveLength(1)
  })

  it('refuses to block someone in another firm', async () => {
    const a = await firm('alpha')
    const b = await firm('beta')

    const result = await setPersonBlocked({
      actorId: a.ownerId,
      targetId: b.ownerId, // firm B's owner
      workspaceId: a.wsId, // firm A's owner is acting
      blocked: true,
    })
    expect(result).toBe('notfound')

    // The load-bearing half: B's owner is genuinely untouched and still able to
    // hold a session. A 'notfound' returned after the write would be worse than
    // useless.
    const target = await db.query.users.findFirst({ where: eq(users.id, b.ownerId) })
    expect(target?.blockedAt).toBeNull()
    const token = (await createSession(b.ownerId)).token
    expect(await validateSessionToken(token)).not.toBeNull()
  })

  it('refuses to reset the password of someone in another firm', async () => {
    const a = await firm('alpha')
    const b = await firm('beta')

    const before = await db.query.users.findFirst({ where: eq(users.id, b.ownerId) })
    const result = await resetPersonPassword({ targetId: b.ownerId, workspaceId: a.wsId })
    expect(result.ok).toBe(false)

    const after = await db.query.users.findFirst({ where: eq(users.id, b.ownerId) })
    expect(after?.passwordHash).toBe(before?.passwordHash)
    expect(after?.mustChangePassword).toBe(false)
  })

  it('blocks someone in the caller’s own firm, and kills their session', async () => {
    const a = await firm('alpha')
    const staff = await createPerson({
      workspaceId: a.wsId,
      email: `staff-${uniq()}@alpha.test`,
      name: null,
      role: 'member',
    })
    expect(staff.ok).toBe(true)
    if (!staff.ok) return
    madeUsers.push(staff.userId)

    const token = (await createSession(staff.userId)).token
    expect(await validateSessionToken(token)).not.toBeNull() // non-vacuous

    expect(
      await setPersonBlocked({
        actorId: a.ownerId,
        targetId: staff.userId,
        workspaceId: a.wsId,
        blocked: true,
      }),
    ).toBe('ok')
    expect(await validateSessionToken(token)).toBeNull()
  })

  it('refuses to block yourself — a one-way door out of the panel', async () => {
    const a = await firm('alpha')
    expect(
      await setPersonBlocked({
        actorId: a.ownerId,
        targetId: a.ownerId,
        workspaceId: a.wsId,
        blocked: true,
      }),
    ).toBe('self')
  })

  it('an owner may create another owner — one admin is a single point of failure', async () => {
    const a = await firm('alpha')
    const res = await createPerson({
      workspaceId: a.wsId,
      email: `coowner-${uniq()}@alpha.test`,
      name: null,
      role: 'owner',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    madeUsers.push(res.userId)
    const mem = await db.query.memberships.findFirst({ where: eq(memberships.userId, res.userId) })
    expect(mem?.role).toBe('owner')
  })
})
