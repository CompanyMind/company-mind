'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n'
import { useTourTarget } from '@/lib/tour/targets'

/**
 * Inline 16px icons. No icon dependency is added for six glyphs — each is a
 * stroked path on a 16-box inheriting currentColor, which is what lets
 * .nav-link tint the active one with --brain.
 */
const ICONS: Record<string, React.ReactNode> = {
  Ask: <path d="M2.5 7.5a5 5 0 0 1 5-5h1a5 5 0 0 1 0 10H6l-3 2.5v-3a5 5 0 0 1-.5-4.5Z" />,
  Sources: <path d="M2.5 4.5h11v9h-11zM2.5 7.5h11M6 4.5v9" />,
  Access: <path d="M11 6.5a2.5 2.5 0 1 0-5 0m-3.5 0h12v7h-12zM8 9.5v1.5" />,
  People: <path d="M6 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3.5 6c0-2 1.6-3.2 3.5-3.2s3.5 1.2 3.5 3.2M11 4.2a2 2 0 0 1 0 3.6m1 2.4c1.4.3 2.5 1.3 2.5 3.3" />,
  Integrations: <path d="M6 2.5v3M10 2.5v3M4 5.5h8v3a4 4 0 0 1-8 0zM8 12.5v2" />,
  Atlas: <path d="M8 2.5v11M2.5 8h11M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />,
  Platform: <path d="M2.5 3.5h11v4h-11zM2.5 9.5h11v3h-11zM5 5.5h.01M5 11h.01" />,
}

function Icon({ label }: { label: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICONS[label]}
    </svg>
  )
}

export function SidebarNav({
  dict,
  isOwner,
  isSuperAdmin,
  deploymentMode,
  collapsed,
}: {
  dict: Dictionary['nav']
  isOwner: boolean
  isSuperAdmin: boolean
  /** Presentation only — see lib/env.ts. Authorization is unchanged in both
   *  modes; this decides whether the Platform entry is offered, since an
   *  on-prem install has exactly one firm and nothing to provision. */
  deploymentMode: 'hosted' | 'onprem'
  collapsed: boolean
}) {
  const path = usePathname()
  // `icon` keys ICONS below and never changes with locale; `label` is what the
  // reader sees and does.
  const NAV = [
    { href: '/dashboard', icon: 'Ask', label: dict.ask },
    { href: '/dashboard/sources', icon: 'Sources', label: dict.sources },
    // Access stays for members: it is where the permanent explanation of the
    // access model lives, and a member needs to be able to read why an answer
    // was scoped. The page itself is read-only for them.
    { href: '/dashboard/access', icon: 'Access', label: dict.access },
    // Owner-only, like Integrations and Atlas — the pages notFound() for
    // members, so the links would be dead ends.
    ...(isOwner ? [{ href: '/dashboard/people', icon: 'People', label: dict.people }] : []),
    ...(isOwner
      ? [{ href: '/dashboard/integrations', icon: 'Integrations', label: dict.integrations }]
      : []),
    ...(isOwner ? [{ href: '/dashboard/atlas', icon: 'Atlas', label: dict.atlas }] : []),
    // The platform tier lives outside this shell entirely — it needs no
    // workspace, and its surfaces are firms and usage, not Ask/Sources.
    ...(isSuperAdmin && deploymentMode === 'hosted'
      ? [{ href: '/platform', icon: 'Platform', label: dict.platform }]
      : []),
  ]
  // Two of NAV's entries are tour anchors. Hooks can't be called inside the
  // `.map()` below (NAV's length varies with isOwner/isSuperAdmin, which
  // would violate the Rules of Hooks), so both are obtained here,
  // unconditionally, and matched to their entry by `href` inside the loop —
  // keying off `href` instead of adding an optional field to NAV keeps that
  // array a plain, declarative href/label list instead of coupling routing
  // config to tour internals for the 2 of 7 entries that need it.
  const sourcesRef = useTourTarget('rail-sources')
  const accessRef = useTourTarget('rail-access')
  const tourRefByHref: Partial<Record<string, (el: HTMLElement | null) => void>> = {
    '/dashboard/sources': sourcesRef,
    '/dashboard/access': accessRef,
  }

  // An open thread IS the Ask surface, so /dashboard stays lit under
  // /dashboard/c/... — but nothing else may match by prefix, or Sources would
  // light up on /dashboard/sources/[folderId] and on /dashboard alike.
  const isActive = (href: string) =>
    href === '/dashboard' ? path === '/dashboard' || path.startsWith('/dashboard/c/') : path === href

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          ref={tourRefByHref[n.href]}
          data-active={isActive(n.href)}
          className="nav-link"
          title={collapsed ? n.label : undefined}
        >
          <Icon label={n.icon} />
          <span className={collapsed ? 'sr-only' : ''}>{n.label}</span>
        </Link>
      ))}
    </nav>
  )
}
