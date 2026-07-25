import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions, users } from '@/lib/db/schema'

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
