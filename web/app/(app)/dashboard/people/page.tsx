import { notFound } from 'next/navigation'
import { getOwner } from '@/lib/auth/require-owner'
import { issueCsrf } from '@/lib/csrf'
import { listPeople } from '@/lib/people'
import { PeoplePanel } from './PeoplePanel'

export const runtime = 'nodejs'

// Owner-only. notFound() rather than a redirect keeps this consistent with the
// other owner-only page (Integrations); the API routes it calls return 403.
export default async function PeoplePage() {
  const owner = await getOwner()
  if (!owner) notFound()

  const [csrf, people] = await Promise.all([issueCsrf(), listPeople(owner.workspaceId)])

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">People</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Everyone at your organisation. Create an account here, then decide what they can read on
          the <strong className="text-ink">Access</strong> page — a new person starts in the
          Everyone group and sees only what is shared with it.
        </p>
      </header>
      <PeoplePanel csrf={csrf} initialPeople={people} currentUserId={owner.userId} />
    </div>
  )
}
