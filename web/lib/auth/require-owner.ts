import 'server-only'
import { getCurrentUser } from '@/lib/auth/current-user'

// The gate for every owner-only surface: Atlas, the whole control plane
// (document groups, group CRUD, group members, folder CRUD, AI organise,
// Telegram) and /dashboard/people. Role is an auth-table fact resolved from
// `memberships` inside validateSessionToken — never trust a client-supplied
// role, and never re-query for it here now that the session carries it.
export async function getOwner(): Promise<{ userId: string; workspaceId: string } | null> {
  const auth = await getCurrentUser()
  if (!auth || auth.role !== 'owner') return null
  return { userId: auth.user.id, workspaceId: auth.workspace.id }
}
