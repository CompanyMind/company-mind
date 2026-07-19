import 'server-only'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'

// Atlas is an owner-only governance surface. Role is an auth-table fact
// (memberships), resolved the same way as `s/[chunkId]/page.tsx` and the ask
// route — never trust a client-supplied role.
export async function getOwner(): Promise<{ userId: string; workspaceId: string } | null> {
  const auth = await getCurrentUser()
  if (!auth) return null
  const mem = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, auth.user.id), eq(memberships.workspaceId, auth.workspace.id)),
  })
  if (mem?.role !== 'owner') return null
  return { userId: auth.user.id, workspaceId: auth.workspace.id }
}
