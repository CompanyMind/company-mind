import { notFound } from 'next/navigation'
import { getOwner } from '@/lib/auth/require-owner'
import { issueCsrf } from '@/lib/csrf'
import { Integrations } from './Integrations'

export const runtime = 'nodejs'

// Owner-only. Every Telegram route is now owner-gated: connecting a bot,
// approving an outside Telegram identity, and granting that identity access
// groups all hand access to someone who is not even a workspace user.
export default async function IntegrationsPage() {
  const owner = await getOwner()
  if (!owner) notFound()
  const csrf = await issueCsrf()
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header>
        <h1 className="font-display text-2xl text-ink">Integrations</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Reach your brain where your team already works.
        </p>
      </header>
      <Integrations csrf={csrf} />
    </div>
  )
}
