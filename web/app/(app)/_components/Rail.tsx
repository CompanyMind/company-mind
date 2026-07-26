'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTourTarget } from '@/lib/tour/targets'
import { Wordmark } from './Wordmark'

export function Rail({
  workspace,
  userName,
  isOwner,
  isSuperAdmin,
}: {
  workspace: string
  userName: string | null
  isOwner: boolean
  isSuperAdmin: boolean
}) {
  const path = usePathname()
  const NAV = [
    { href: '/dashboard', label: 'Ask' },
    { href: '/dashboard/sources', label: 'Sources' },
    { href: '/dashboard/access', label: 'Access' },
    { href: '/dashboard/integrations', label: 'Integrations' },
    ...(isOwner ? [{ href: '/dashboard/atlas', label: 'Atlas' }] : []),
    ...(isSuperAdmin ? [{ href: '/dashboard/admin', label: 'Admin' }] : []),
  ]
  // Two of NAV's entries are tour anchors. Hooks can't be called inside the
  // `.map()` below (NAV's length varies with isOwner/isSuperAdmin, which
  // would violate the Rules of Hooks), so both are obtained here,
  // unconditionally, and matched to their entry by `href` inside the loop —
  // keying off `href` instead of adding an optional field to NAV keeps that
  // array a plain, declarative href/label list instead of coupling routing
  // config to tour internals for the 2 of 6 entries that need it.
  const sourcesRef = useTourTarget('rail-sources')
  const accessRef = useTourTarget('rail-access')
  const tourRefByHref: Partial<Record<string, (el: HTMLElement | null) => void>> = {
    '/dashboard/sources': sourcesRef,
    '/dashboard/access': accessRef,
  }
  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper-sunk px-4 py-5 max-md:h-auto max-md:w-full max-md:flex-row max-md:items-center max-md:justify-between max-md:py-3">
      <div className="max-md:flex max-md:items-center max-md:gap-6">
        <Wordmark className="text-ink" />
        <nav className="mt-8 flex flex-col gap-1 max-md:mt-0 max-md:flex-row">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              ref={tourRefByHref[n.href]}
              data-active={path === n.href}
              className="rail-link"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto flex flex-col gap-3 max-md:mt-0 max-md:flex-row max-md:items-center">
        <div className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-soft">
          <span
            className="h-1.5 w-1.5 rounded-full bg-brain motion-safe:animate-heartbeat"
            aria-hidden="true"
          />
          egress 0 B
        </div>
        <div className="text-body-sm text-ink-soft max-md:hidden">{workspace}</div>
        <form action="/logout" method="post">
          <button className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink">
            Sign out{userName ? ` · ${userName}` : ''}
          </button>
        </form>
      </div>
    </aside>
  )
}
