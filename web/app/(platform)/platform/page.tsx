import { issueCsrf } from '@/lib/csrf'
import { listFirms } from '@/lib/platform/firms'
import { FirmsPanel } from './FirmsPanel'

export const runtime = 'nodejs'

// The layout has already gated this on getSuperAdmin() and 404s otherwise.
export default async function PlatformPage() {
  const [csrf, firms] = await Promise.all([issueCsrf(), listFirms()])

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Firms</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Open an account for a company, or suspend one. Individual staff accounts are the firm
          owner&rsquo;s to create, not yours — you never see a firm&rsquo;s documents or questions.
        </p>
      </header>
      <FirmsPanel csrf={csrf} initialFirms={firms} />
    </>
  )
}
