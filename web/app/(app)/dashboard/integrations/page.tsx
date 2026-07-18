import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { Integrations } from './Integrations'

export const runtime = 'nodejs'

export default async function IntegrationsPage() {
  await getCurrentUser()
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
