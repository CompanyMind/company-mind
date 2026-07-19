import { redirect } from 'next/navigation'
import { getOwner } from '@/lib/auth/require-owner'
import { issueCsrf } from '@/lib/csrf'
import { listGroups } from '@/lib/groups'
import { BrainMap } from './BrainMap'

export const runtime = 'nodejs'

// Owner-only governance surface. `getOwner()` reads role from the auth-table
// `memberships` (never a client-supplied claim) — anyone else is bounced back
// to the ask page, same pattern as the /api/graph* routes this page calls.
export default async function BrainMapPage() {
  const owner = await getOwner()
  if (!owner) redirect('/dashboard')
  const csrf = await issueCsrf()
  const groups = await listGroups(owner.workspaceId)
  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-line px-6 py-4">
        <h1 className="font-display text-2xl text-ink">Brain Map</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          What your company knows, who can see it, and what needs fixing.
        </p>
      </header>
      <BrainMap csrf={csrf} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
    </div>
  )
}
