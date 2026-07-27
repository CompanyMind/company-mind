import Link from 'next/link'
import { getUsageSummary } from '@/lib/usage'
import { UsageTable } from './UsageTable'

export const runtime = 'nodejs'

// Gated by (platform)/layout.tsx. Aggregate-only, and that is a tested
// invariant, not a convention — see lib/platform/aggregate-only.test.ts.
export default async function PlatformUsagePage() {
  const summary = await getUsageSummary(30)

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Usage</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Trailing {summary.days} days, aggregate only — no individual question is ever shown here,
          and no per-person activity row exists to show.{' '}
          <Link href="/platform" className="underline underline-offset-2 hover:text-ink">
            Back to firms
          </Link>
        </p>
      </header>
      <UsageTable summary={summary} />
    </>
  )
}
