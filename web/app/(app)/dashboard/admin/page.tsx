import { notFound } from 'next/navigation'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { issueCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'
import { AdminPanel } from './AdminPanel'

export const runtime = 'nodejs'

// Platform-level, above any workspace — 404, not redirect, on a non-admin, so
// the panel's existence is never disclosed (same contract as every /api/admin
// route this page calls).
export default async function AdminPage() {
  const admin = await getSuperAdmin()
  if (!admin) notFound()

  const csrf = await issueCsrf()
  const workspaceOptions = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .orderBy(workspaces.name)

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-2">
        <h1 className="font-display text-2xl text-ink">Admin</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Platform-wide usage and accounts. Visible only to a super-admin.
        </p>
      </header>
      <AdminPanel csrf={csrf} workspaces={workspaceOptions} currentUserId={admin.userId} />
    </div>
  )
}
