import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { validateSessionUserOnly } from '@/lib/auth/session-store'

// Platform-level, ABOVE workspaces — resolved from the users table, never from
// anything client-supplied. Callers 404 rather than 403 on null, so the panel's
// existence is not disclosed to a non-admin.
//
// Uses validateSessionUserOnly, not getCurrentUser: in `hosted` mode the
// platform operator owns no firm, and getCurrentUser requires a membership row.
// Gating the platform tier on getCurrentUser would lock the operator out of the
// only surface they exist to use.
export async function getSuperAdmin(): Promise<{ userId: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const user = await validateSessionUserOnly(token)
  if (!user?.isSuperAdmin) return null
  return { userId: user.id }
}
