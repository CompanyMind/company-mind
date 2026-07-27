import 'server-only'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions, users } from '@/lib/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { hashToken } from '@/lib/auth/session'

/** A floor, not a policy engine. Composition rules ("one symbol, one digit")
 *  push people towards predictable substitutions; length is what actually
 *  helps. The generated temp passwords are 18 chars, comfortably above this. */
export const MIN_PASSWORD_LENGTH = 12

export type ChangeResult = 'ok' | 'wrong-password' | 'too-short' | 'same-password' | 'notfound'

/**
 * Rotate a user's own password.
 *
 * Deliberately requires the current password even though the caller is already
 * authenticated: without it, anyone who walks up to an unlocked screen can lock
 * the real owner out of their account permanently.
 *
 * `keepSessionToken` is the caller's own session. Every OTHER session for that
 * user is deleted, because "change your password" is what someone does after a
 * password leaks, and leaving the leaked session alive would make the act
 * pointless. The caller's own session survives so they are not bounced to login
 * the instant they succeed.
 */
export async function changePassword(opts: {
  userId: string
  currentPassword: string
  newPassword: string
  keepSessionToken?: string
}): Promise<ChangeResult> {
  const user = await db.query.users.findFirst({ where: eq(users.id, opts.userId) })
  if (!user) return 'notfound'

  // Verified BEFORE the length check, so a wrong current password reveals
  // nothing about whether the proposed new one would have been acceptable.
  if (!(await verifyPassword(user.passwordHash, opts.currentPassword))) return 'wrong-password'

  if (opts.newPassword.length < MIN_PASSWORD_LENGTH) return 'too-short'
  if (opts.newPassword === opts.currentPassword) return 'same-password'

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(opts.newPassword), mustChangePassword: false })
    .where(eq(users.id, opts.userId))

  await db
    .delete(sessions)
    .where(
      opts.keepSessionToken
        ? and(
            eq(sessions.userId, opts.userId),
            ne(sessions.tokenHash, hashToken(opts.keepSessionToken)),
          )
        : eq(sessions.userId, opts.userId),
    )

  return 'ok'
}
