import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { issueCsrf } from '@/lib/csrf'
import { getDictionary, isLocale } from '@/lib/i18n'
import { listGroups } from '@/lib/groups'
import { Atlas } from './Atlas'

export const runtime = 'nodejs'

// Owner-only governance surface. `getOwner()` reads role from the auth-table
// `memberships` (never a client-supplied claim) — anyone else is bounced back
// to the ask page, same pattern as the /api/graph* routes this page calls.
export default async function AtlasPage() {
  const owner = await getOwner()
  if (!owner) redirect('/dashboard')
  const csrf = await issueCsrf()
  const groups = await listGroups(owner.workspaceId)
  // A second `getCurrentUser()` call, alongside `getOwner()`'s own internal
  // one — `getOwner()`'s return shape is a narrow `{userId, workspaceId}`
  // shared by every /api/graph* route and covered by its own test, so it
  // isn't widened here just to thread locale through one page.
  const auth = await getCurrentUser()
  const dict = getDictionary(auth && isLocale(auth.user.locale) ? auth.user.locale : 'en')
  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-line px-6 py-4">
        <h1 className="font-display text-2xl text-ink">Atlas</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          What your company knows, who can see it, and what needs fixing.
        </p>
      </header>
      <Atlas
        csrf={csrf}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        emptyState={dict.emptyStates.atlas}
      />
    </div>
  )
}
