/**
 * Firm provisioning — the platform tier's whole reason to exist.
 *
 * Real database: the assertions that matter are atomicity (no half-created firm)
 * and that suspending actually deletes rows from `sessions`. Both are properties
 * of the transaction, which a mock cannot have.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { memberships, sessions, users, workspaces } from '@/lib/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, validateSessionToken } from '@/lib/auth/session-store'
import { createFirm, setFirmSuspended, resetOwnerPassword, listFirms } from '@/lib/platform/firms'

const HAS_DB = !!process.env.DATABASE_URL
const made: { workspaces: string[]; users: string[] } = { workspaces: [], users: [] }

function track(r: { workspaceId: string; ownerId: string }) {
  made.workspaces.push(r.workspaceId)
  made.users.push(r.ownerId)
}

afterEach(async () => {
  if (!HAS_DB) return
  if (made.workspaces.length)
    await db.delete(workspaces).where(inArray(workspaces.id, made.workspaces))
  if (made.users.length) await db.delete(users).where(inArray(users.id, made.users))
  made.workspaces = []
  made.users = []
})

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!HAS_DB)('createFirm', () => {
  it('creates a workspace, an owner who can sign in, and returns the password once', async () => {
    const tag = uniq()
    const res = await createFirm({
      name: `Acme ${tag}`,
      ownerEmail: `owner-${tag}@acme.test`,
      ownerName: 'Ada',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    track(res)

    const owner = await db.query.users.findFirst({ where: eq(users.id, res.ownerId) })
    expect(owner).toBeTruthy()
    // The password authenticates, is stored as an argon2id hash, and is never
    // the plaintext.
    expect(owner!.passwordHash).not.toContain(res.tempPassword)
    expect(await verifyPassword(owner!.passwordHash, res.tempPassword)).toBe(true)
    // They did not choose it, so they must replace it.
    expect(owner!.mustChangePassword).toBe(true)
    // The panel can never mint another platform operator.
    expect(owner!.isSuperAdmin).toBe(false)

    const mem = await db.query.memberships.findFirst({ where: eq(memberships.userId, res.ownerId) })
    expect(mem?.role).toBe('owner')
    expect(mem?.workspaceId).toBe(res.workspaceId)
  })

  it('reports whether the engine bootstrapped the Everyone group', async () => {
    const tag = uniq()
    const res = await createFirm({
      name: `Boot ${tag}`,
      ownerEmail: `boot-${tag}@acme.test`,
      ownerName: null,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    track(res)

    // The flag must reflect reality, not optimism: true only if the group is
    // actually there. Whether the engine is reachable in this run is
    // environmental, so assert the IMPLICATION rather than a fixed value —
    // a `bootstrapped: true` that lied would fail here.
    const groups = await db.execute(
      sql`SELECT 1 FROM groups WHERE workspace_id = ${res.workspaceId} AND is_default = true`,
    )
    const groupExists = Array.from(groups as unknown as unknown[]).length > 0
    if (res.bootstrapped) expect(groupExists).toBe(true)
  })

  it('refuses a duplicate owner email and leaves no orphan workspace behind', async () => {
    const tag = uniq()
    const first = await createFirm({
      name: `First ${tag}`,
      ownerEmail: `dup-${tag}@acme.test`,
      ownerName: null,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    track(first)

    const second = await createFirm({
      name: `Second ${tag}`,
      ownerEmail: `dup-${tag}@acme.test`,
      ownerName: null,
    })

    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.reason).toBe('duplicate-email')

    // The load-bearing assertion: the rejected attempt created NOTHING.
    // Asserted against THIS attempt's own name, not a global workspace count —
    // vitest runs test files in parallel, so a count taken before and after is
    // a race against every other suite that creates a firm.
    const orphan = await db.query.workspaces.findFirst({
      where: eq(workspaces.name, `Second ${tag}`),
    })
    expect(orphan).toBeUndefined()
  })

  it('lists the firm with its owner and user count', async () => {
    const tag = uniq()
    const res = await createFirm({
      name: `Listed ${tag}`,
      ownerEmail: `listed-${tag}@acme.test`,
      ownerName: null,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    track(res)

    const firm = (await listFirms()).find((f) => f.id === res.workspaceId)
    expect(firm).toBeTruthy()
    expect(firm!.userCount).toBe(1)
    expect(firm!.owners.map((o) => o.email)).toEqual([`listed-${tag}@acme.test`])
    expect(firm!.suspendedAt).toBeNull()
  })
})

describe.skipIf(!HAS_DB)('setFirmSuspended', () => {
  it('kills the firm’s live sessions and refuses them thereafter', async () => {
    const tag = uniq()
    const res = await createFirm({
      name: `Suspend ${tag}`,
      ownerEmail: `susp-${tag}@acme.test`,
      ownerName: null,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    track(res)

    const token = (await createSession(res.ownerId)).token
    expect(await validateSessionToken(token)).not.toBeNull() // non-vacuous

    expect(await setFirmSuspended(res.workspaceId, true)).toBe('ok')

    // Both halves: the rows are gone AND the check refuses.
    const left = await db.select().from(sessions).where(eq(sessions.userId, res.ownerId))
    expect(left).toHaveLength(0)
    expect(await validateSessionToken(token)).toBeNull()

    // Reversible.
    expect(await setFirmSuspended(res.workspaceId, false)).toBe('ok')
    const fresh = (await createSession(res.ownerId)).token
    expect(await validateSessionToken(fresh)).not.toBeNull()
  })

  it('reports notfound for a workspace that does not exist', async () => {
    expect(await setFirmSuspended('00000000-0000-0000-0000-000000000000', true)).toBe('notfound')
  })
})

describe.skipIf(!HAS_DB)('resetOwnerPassword', () => {
  it('rotates an owner’s password, forces a change, and drops their sessions', async () => {
    const tag = uniq()
    const res = await createFirm({
      name: `Reset ${tag}`,
      ownerEmail: `reset-${tag}@acme.test`,
      ownerName: null,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    track(res)

    const token = (await createSession(res.ownerId)).token
    const out = await resetOwnerPassword(res.ownerId)
    expect(out.ok).toBe(true)
    if (!out.ok) return

    const owner = await db.query.users.findFirst({ where: eq(users.id, res.ownerId) })
    expect(await verifyPassword(owner!.passwordHash, out.tempPassword)).toBe(true)
    expect(await verifyPassword(owner!.passwordHash, res.tempPassword)).toBe(false)
    expect(owner!.mustChangePassword).toBe(true)
    expect(await validateSessionToken(token)).toBeNull()
  })

  it('refuses to reset a member — members are their own firm’s business', async () => {
    const tag = uniq()
    const res = await createFirm({
      name: `Member ${tag}`,
      ownerEmail: `mowner-${tag}@acme.test`,
      ownerName: null,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    track(res)

    const [member] = await db
      .insert(users)
      .values({ email: `member-${tag}@acme.test`, passwordHash: 'x' })
      .returning()
    made.users.push(member.id)
    await db
      .insert(memberships)
      .values({ userId: member.id, workspaceId: res.workspaceId, role: 'member' })

    const out = await resetOwnerPassword(member.id)
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('not-an-owner')
  })
})
