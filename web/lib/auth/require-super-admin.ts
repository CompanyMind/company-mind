import 'server-only'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

// Platform-level, above workspaces — resolved from the users table, never from
// anything client-supplied. Callers 404 rather than 403 on null, so the panel's
// existence is not disclosed to a non-admin.
export async function getSuperAdmin(): Promise<{ userId: string } | null> {
  const auth = await getCurrentUser()
  if (!auth) return null
  const row = await db.query.users.findFirst({
    where: eq(users.id, auth.user.id),
    columns: { isSuperAdmin: true },
  })
  if (!row?.isSuperAdmin) return null
  return { userId: auth.user.id }
}
