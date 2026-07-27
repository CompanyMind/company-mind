import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { issueCsrf } from '@/lib/csrf'
import { getDictionary, isLocale } from '@/lib/i18n'
import { Integrations } from './Integrations'

export const runtime = 'nodejs'

// Owner-only. Every Telegram route is now owner-gated: connecting a bot,
// approving an outside Telegram identity, and granting that identity access
// groups all hand access to someone who is not even a workspace user.
export default async function IntegrationsPage() {
  const owner = await getOwner()
  if (!owner) notFound()
  // The gate stays getOwner() — the convention for every owner-only surface.
  // getCurrentUser is only for the locale, which getOwner does not carry.
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  const dict = getDictionary(auth && isLocale(auth.user.locale) ? auth.user.locale : 'en')
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header>
        <h1 className="font-display text-2xl text-ink">{dict.pages.integrations.title}</h1>
        <p className="mt-1 text-body-sm text-ink-soft">{dict.pages.integrations.body}</p>
      </header>
      <Integrations csrf={csrf} />
    </div>
  )
}
