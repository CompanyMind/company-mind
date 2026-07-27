import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'

export const MAX_WORKSPACE_NAME = 120

/**
 * Rename a workspace, as its OWNER.
 *
 * Deliberately not in lib/platform/firms.ts. That module is the platform
 * operator's tier — it opens and suspends firms and never touches what is
 * inside one. An owner renaming their own firm is the tier below, and putting
 * the two in the same file is how a tier split quietly stops meaning anything.
 *
 * The workspace id always comes from the caller's own session (see the route);
 * this function never resolves one for itself.
 */
export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  await db.update(workspaces).set({ name }).where(eq(workspaces.id, workspaceId))
}
