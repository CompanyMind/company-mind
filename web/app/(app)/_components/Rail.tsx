'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDictionary, isLocale } from '@/lib/i18n'
import { useTour } from './tour/TourProvider'
import { useTourTarget } from '@/lib/tour/targets'
import { Wordmark } from './Wordmark'

export function Rail({
  workspace,
  userName,
  isOwner,
  isSuperAdmin,
  locale,
}: {
  workspace: string
  userName: string | null
  isOwner: boolean
  isSuperAdmin: boolean
  locale: string
}) {
  const path = usePathname()
  const dict = getDictionary(isLocale(locale) ? locale : 'en')
  // The permanent replay entry point (spec §5) — the only affordance that
  // serves a user onboarded outside the narrow auto-start window (a deep
  // link, a dismissal they regret, a step added long after they joined).
  // `fromBeginning: true`: Guide is a deliberate full walkthrough, not a
  // resume — it never clears user_tour_steps (the POST route is
  // insert-only, ON CONFLICT DO NOTHING), so replaying changes nothing about
  // what a FUTURE new step's set-difference check will see.
  const { start } = useTour()
  const NAV = [
    { href: '/dashboard', label: 'Ask' },
    { href: '/dashboard/sources', label: 'Sources' },
    // Access stays for members: it is where the permanent explanation of the
    // access model lives, and a member needs to be able to read why an answer
    // was scoped. The page itself is read-only for them.
    { href: '/dashboard/access', label: 'Access' },
    // Integrations is owner-only — the page notFound()s for members, so the
    // link would be a dead end.
    ...(isOwner ? [{ href: '/dashboard/integrations', label: 'Integrations' }] : []),
    ...(isOwner ? [{ href: '/dashboard/atlas', label: 'Atlas' }] : []),
    // The platform tier lives outside this shell entirely — it needs no
    // workspace, and its surfaces are firms and usage, not Ask/Sources.
    ...(isSuperAdmin ? [{ href: '/platform', label: 'Platform' }] : []),
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
        <button
          type="button"
          onClick={() => start({ fromBeginning: true })}
          className="self-start text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink max-md:self-auto"
        >
          {dict.tour.ui.guide}
        </button>
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
