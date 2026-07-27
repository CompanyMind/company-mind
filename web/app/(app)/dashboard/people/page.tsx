import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { issueCsrf } from '@/lib/csrf'
import { getDictionary, isLocale } from '@/lib/i18n'
import { listPeople } from '@/lib/people'
import { PeoplePanel } from './PeoplePanel'

export const runtime = 'nodejs'

// Owner-only. notFound() rather than a redirect keeps this consistent with the
// other owner-only page (Integrations); the API routes it calls return 403.
export default async function PeoplePage() {
  const owner = await getOwner()
  if (!owner) notFound()

  // The gate stays getOwner() — the convention for every owner-only surface.
  // getCurrentUser is only for the locale, which getOwner does not carry.
  const [csrf, people, auth] = await Promise.all([
    issueCsrf(),
    listPeople(owner.workspaceId),
    getCurrentUser(),
  ])
  const dict = getDictionary(auth && isLocale(auth.user.locale) ? auth.user.locale : 'en')

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">{dict.pages.people.title}</h1>
        <p className="mt-1 text-body-sm text-ink-soft">{dict.pages.people.body}</p>
      </header>
      <PeoplePanel csrf={csrf} initialPeople={people} currentUserId={owner.userId} dict={dict} />
    </div>
  )
}
