import 'server-only'
import { and, eq, inArray, max } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { memberships, sessions, users } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { generateTempPassword } from '@/lib/auth/admin-users'

export type PersonRow = {
  id: string
  email: string
  name: string | null
  role: 'owner' | 'member'
  createdAt: Date
  lastSeenAt: Date | null
  blocked: boolean
}

/**
 * Everyone in ONE firm.
 *
 * `workspaceId` always comes from the caller's session — never from a request
 * body or query string. That is the whole cross-tenant guarantee of this module,
 * and `people-scoping.test.ts` asserts a forged body value cannot move it.
 */
export async function listPeople(workspaceId: string): Promise<PersonRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
      createdAt: users.createdAt,
      blockedAt: users.blockedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(users.email)

  // "Recently active", not "ever logged in": sessions are deleted on block, on
  // suspension and on expiry. Labelled that way in the UI rather than overstated.
  //
  // Scoped to THIS firm's users. It used to aggregate the entire `sessions`
  // table — every firm on the deployment — and then discard all but these rows
  // in JS, so the cost of rendering one firm's People page grew with total
  // platform traffic rather than with the size of that firm.
  const userIds = rows.map((r) => r.id)
  const latest = userIds.length
    ? await db
        .select({ userId: sessions.userId, last: max(sessions.createdAt) })
        .from(sessions)
        .where(inArray(sessions.userId, userIds))
        .groupBy(sessions.userId)
    : []
  const lastById = new Map(latest.map((r) => [r.userId, r.last]))

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role === 'owner' ? 'owner' : 'member',
    createdAt: r.createdAt,
    lastSeenAt: lastById.get(r.id) ?? null,
    blocked: r.blockedAt !== null,
  }))
}

export type CreatePersonResult =
  | { ok: true; userId: string; tempPassword: string }
  | { ok: false; reason: 'duplicate-email' }

/**
 * Create a staff account inside the caller's own firm.
 *
 * An owner may create another owner: a firm with a single admin is a single
 * point of failure that the platform operator then has to unlock by hand.
 * `isSuperAdmin` is hard-coded false and is not a parameter — the platform
 * super-admin stays seed-only, or anyone reaching this once could guarantee
 * themselves permanent platform access.
 */
export async function createPerson(opts: {
  workspaceId: string
  email: string
  name: string | null
  role: 'owner' | 'member'
}): Promise<CreatePersonResult> {
  const email = opts.email.trim().toLowerCase()
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  // One user, one firm (unique index on memberships.user_id), so an address
  // already in use anywhere cannot be added here either.
  if (existing) return { ok: false, reason: 'duplicate-email' }

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)

  let userId = ''
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          email,
          name: opts.name,
          passwordHash,
          isSuperAdmin: false,
          mustChangePassword: true,
        })
        .returning({ id: users.id })
      userId = row.id
      await tx
        .insert(memberships)
        .values({ userId: row.id, workspaceId: opts.workspaceId, role: opts.role })
    })
  } catch (e) {
    if (String(e).includes('users_email')) return { ok: false, reason: 'duplicate-email' }
    throw e
  }

  return { ok: true, userId, tempPassword }
}

/** True only if this user belongs to this firm. Every mutation below gates on
 *  it, so an owner cannot reach a person in another firm by guessing an id. */
async function inWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  const row = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)),
  })
  return !!row
}

export async function setPersonBlocked(opts: {
  actorId: string
  targetId: string
  workspaceId: string
  blocked: boolean
}): Promise<'ok' | 'self' | 'notfound'> {
  // Blocking yourself locks you out of the surface that could unblock you.
  if (opts.actorId === opts.targetId) return 'self'
  if (!(await inWorkspace(opts.targetId, opts.workspaceId))) return 'notfound'

  await db
    .update(users)
    .set({ blockedAt: opts.blocked ? new Date() : null })
    .where(eq(users.id, opts.targetId))
  // Setting the flag alone is theatre — the existing cookie would keep working
  // until it expired. Deleting the sessions is what makes it immediate.
  if (opts.blocked) await db.delete(sessions).where(eq(sessions.userId, opts.targetId))
  return 'ok'
}

export async function resetPersonPassword(opts: {
  targetId: string
  workspaceId: string
}): Promise<{ ok: true; tempPassword: string } | { ok: false; reason: 'notfound' }> {
  if (!(await inWorkspace(opts.targetId, opts.workspaceId))) return { ok: false, reason: 'notfound' }

  const tempPassword = generateTempPassword()
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true })
    .where(eq(users.id, opts.targetId))
  await db.delete(sessions).where(eq(sessions.userId, opts.targetId))
  return { ok: true, tempPassword }
}
