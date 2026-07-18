import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { AccessManager } from './AccessManager'

export const runtime = 'nodejs'

export default async function AccessPage() {
  await getCurrentUser()
  const csrf = await issueCsrf()
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header>
        <h1 className="font-display text-2xl text-ink">Access</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Who can see which knowledge. Tag documents with groups in Sources.
        </p>
      </header>
      <AccessManager csrf={csrf} />
    </div>
  )
}
