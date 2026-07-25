import 'server-only'
import { eq, max } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { memberships, sessions, users, workspaces } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'

/** Pure guard, unit-tested: blocking yourself locks you out of the only
 *  surface that could unblock you. */
export function wouldBlockSelf(actorId: string, targetId: string): boolean {
  return actorId === targetId
}

export async function blockUser(
  actorId: string,
  targetId: string,
): Promise<'ok' | 'self' | 'notfound'> {
  if (wouldBlockSelf(actorId, targetId)) return 'self'
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) })
  if (!target) return 'notfound'
  await db.update(users).set({ blockedAt: new Date() }).where(eq(users.id, targetId))
  // Setting the flag alone is theatre — an existing cookie would keep working
  // until it expired. Deleting the sessions is what makes blocking immediate.
  await db.delete(sessions).where(eq(sessions.userId, targetId))
  return 'ok'
}

export async function unblockUser(targetId: string): Promise<boolean> {
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) })
  if (!target) return false
  await db.update(users).set({ blockedAt: null }).where(eq(users.id, targetId))
  return true
}

export type AdminUserRow = {
  id: string
  email: string
  name: string | null
  workspace: string | null
  role: string | null
  createdAt: Date
  lastLoginAt: Date | null
  blocked: boolean
  isSuperAdmin: boolean
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      blockedAt: users.blockedAt,
      isSuperAdmin: users.isSuperAdmin,
      workspace: workspaces.name,
      role: memberships.role,
    })
    .from(users)
    .leftJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .orderBy(users.email)

  // Last login = the newest session row for that user. Sessions are deleted on
  // block and on expiry, so this is "recently active", not "ever logged in" —
  // labelled accordingly in the UI rather than overstated.
  const latest = await db
    .select({ userId: sessions.userId, last: max(sessions.createdAt) })
    .from(sessions)
    .groupBy(sessions.userId)
  const lastById = new Map(latest.map((r) => [r.userId, r.last]))

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    workspace: r.workspace,
    role: r.role,
    createdAt: r.createdAt,
    lastLoginAt: lastById.get(r.id) ?? null,
    blocked: r.blockedAt !== null,
    isSuperAdmin: r.isSuperAdmin,
  }))
}

export function generateTempPassword(): string {
  // 18 URL-safe chars from crypto randomness. Shown once to the admin and
  // handed over out of band; there is no in-product change-password flow yet.
  return Buffer.from(crypto.getRandomValues(new Uint8Array(14))).toString('base64url')
}

export async function createUser(opts: {
  email: string
  name: string | null
  workspaceId: string
  role: 'owner' | 'member'
}): Promise<{ id: string; tempPassword: string } | 'duplicate'> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, opts.email) })
  if (existing) return 'duplicate'
  const tempPassword = generateTempPassword()
  const [row] = await db
    .insert(users)
    .values({
      email: opts.email,
      name: opts.name,
      passwordHash: await hashPassword(tempPassword),
      // Never set from the panel — the platform super-admin is seed-only.
      isSuperAdmin: false,
    })
    .returning({ id: users.id })
  await db.insert(memberships).values({
    userId: row.id,
    workspaceId: opts.workspaceId,
    role: opts.role,
  })
  return { id: row.id, tempPassword }
}
