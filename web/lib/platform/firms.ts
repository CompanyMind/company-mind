import 'server-only'
import { count, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { enginePath } from '@/lib/engine-url'
import { memberships, sessions, users, workspaces } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { generateTempPassword } from '@/lib/auth/admin-users'

export type FirmRow = {
  id: string
  name: string
  slug: string
  createdAt: Date
  suspendedAt: Date | null
  userCount: number
  owners: { id: string; email: string }[]
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'firm'
  )
}

export async function listFirms(): Promise<FirmRow[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      createdAt: workspaces.createdAt,
      suspendedAt: workspaces.suspendedAt,
      userCount: count(memberships.userId),
    })
    .from(workspaces)
    .leftJoin(memberships, eq(memberships.workspaceId, workspaces.id))
    .groupBy(workspaces.id)
    .orderBy(workspaces.name)

  const ownerRows = await db
    .select({ workspaceId: memberships.workspaceId, id: users.id, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.role, 'owner'))

  const ownersByWs = new Map<string, { id: string; email: string }[]>()
  for (const o of ownerRows) {
    const list = ownersByWs.get(o.workspaceId) ?? []
    list.push({ id: o.id, email: o.email })
    ownersByWs.set(o.workspaceId, list)
  }

  return rows.map((r) => ({ ...r, owners: ownersByWs.get(r.id) ?? [] }))
}

export type CreateFirmResult =
  | {
      ok: true
      workspaceId: string
      ownerId: string
      tempPassword: string
      /** Whether the engine created the firm's Everyone group. Reported rather
       *  than logged: a warning in a server log is invisible to the operator
       *  standing in front of the panel, and the fix (retry) is theirs to make.
       *  False is recoverable — the group is also created lazily on first
       *  upload — so it is a caveat on success, not a failure. */
      bootstrapped: boolean
    }
  | { ok: false; reason: 'duplicate-email' | 'duplicate-slug' }

/**
 * Provision a firm: a workspace, its first owner, and the knowledge-side
 * Everyone group.
 *
 * Atomic across the auth tables. A half-created firm — a workspace nobody can
 * sign into, or a user with no workspace — is invisible in the UI and can only
 * be cleaned up with a database client, which is exactly what this panel exists
 * to avoid.
 *
 * The engine bootstrap call is deliberately AFTER the transaction commits, not
 * inside it: it is a different service over HTTP, so it cannot join this
 * transaction, and holding one open across a network call is the pool-starvation
 * mistake this codebase has already paid for twice. It is idempotent and also
 * happens lazily on first upload, so a failure there costs a retry, not a
 * corrupted firm — which is why it is reported as `bootstrapped: false` on an
 * otherwise successful result rather than rolling the firm back.
 */
export async function createFirm(opts: {
  name: string
  ownerEmail: string
  ownerName: string | null
}): Promise<CreateFirmResult> {
  const email = opts.ownerEmail.trim().toLowerCase()
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) return { ok: false, reason: 'duplicate-email' }

  const slug = slugify(opts.name)
  const slugTaken = await db.query.workspaces.findFirst({ where: eq(workspaces.slug, slug) })
  if (slugTaken) return { ok: false, reason: 'duplicate-slug' }

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)

  let workspaceId = ''
  let ownerId = ''
  try {
    await db.transaction(async (tx) => {
      const [ws] = await tx.insert(workspaces).values({ name: opts.name, slug }).returning()
      workspaceId = ws.id
      const [owner] = await tx
        .insert(users)
        .values({
          email,
          name: opts.ownerName,
          passwordHash,
          // Never from this panel: the platform super-admin stays seed-only, or
          // anyone who reaches the panel once can guarantee themselves access.
          isSuperAdmin: false,
          // They did not choose this password; the operator generated it.
          mustChangePassword: true,
        })
        .returning()
      ownerId = owner.id
      await tx.insert(memberships).values({ userId: owner.id, workspaceId: ws.id, role: 'owner' })
    })
  } catch (e) {
    // A race on either unique constraint lands here rather than as a 500.
    const msg = String(e)
    if (msg.includes('users_email')) return { ok: false, reason: 'duplicate-email' }
    if (msg.includes('workspaces_slug')) return { ok: false, reason: 'duplicate-slug' }
    throw e
  }

  const bootstrapped = await bootstrapWorkspace(workspaceId)
  return { ok: true, workspaceId, ownerId, tempPassword, bootstrapped }
}

/** Knowledge-side setup. Returns false rather than throwing — see createFirm. */
export async function bootstrapWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const res = await fetch(`${env.ENGINE_BASE_URL}${enginePath`/workspaces/${workspaceId}/bootstrap`}`, {
      method: 'POST',
      headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Suspend or resume a firm.
 *
 * Suspending deletes every session belonging to that firm's users, so it takes
 * effect on their next request rather than whenever their cookie happens to
 * expire — the same standard `blockUser` already holds itself to. Resuming does
 * NOT restore sessions; those people sign in again.
 */
export async function setFirmSuspended(
  workspaceId: string,
  suspended: boolean,
): Promise<'ok' | 'notfound'> {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
  if (!ws) return 'notfound'

  await db
    .update(workspaces)
    .set({ suspendedAt: suspended ? new Date() : null })
    .where(eq(workspaces.id, workspaceId))

  if (suspended) {
    await db.delete(sessions).where(
      sql`${sessions.userId} IN (
        SELECT ${memberships.userId} FROM ${memberships}
        WHERE ${memberships.workspaceId} = ${workspaceId}
      )`,
    )
  }
  return 'ok'
}

/**
 * Reset a firm owner's password.
 *
 * The one per-person action the platform tier keeps. A firm's owner is the top
 * of that firm, so nobody inside it can unlock them — without this, an owner who
 * forgets their password or leaves the company needs a database client.
 * Restricted to owners: members are their own firm's business.
 */
export async function resetOwnerPassword(
  userId: string,
): Promise<{ ok: true; tempPassword: string } | { ok: false; reason: 'not-an-owner' }> {
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, userId),
  })
  if (!membership || membership.role !== 'owner') return { ok: false, reason: 'not-an-owner' }

  const tempPassword = generateTempPassword()
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true })
    .where(eq(users.id, userId))
  // Any session opened with the old password dies with it.
  await db.delete(sessions).where(eq(sessions.userId, userId))
  return { ok: true, tempPassword }
}
