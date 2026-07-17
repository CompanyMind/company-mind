'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { nav, cta } from '@/content/site'
import { useScrolled } from '@/hooks/useScrolled'
import { Wordmark } from './Wordmark'
import { cn } from '@/lib/cn'

/**
 * Sticky header. Starts transparent over the hero so the swarm reads edge to
 * edge, then earns a paper backing + hairline once you have scrolled past it.
 */
export function Nav() {
  const pathname = usePathname()
  const scrolled = useScrolled()

  // The menu is open FOR A GIVEN PATH, so navigating closes it for free — no
  // effect mirroring `pathname` into state, and no stale-open menu after a
  // route change (including back/forward, which an onClick handler would miss).
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === pathname

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-paper',
        scrolled ? 'bg-paper/85 backdrop-blur-md' : 'bg-transparent',
      )}
    >
      {/* the hairline is the header's only border — it draws itself in on scroll */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 h-px origin-left bg-line transition-transform duration-700 ease-paper',
          scrolled ? 'scale-x-100' : 'scale-x-0',
        )}
      />
      <nav
        aria-label="Primary"
        className="shell flex h-[var(--nav-h)] items-center justify-between gap-8"
      >
        <Link
          href="/"
          className="text-ink transition-opacity hover:opacity-70"
          aria-label="CompBrain — home"
        >
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative py-1 font-mono text-telemetry uppercase tracking-[0.12em] transition-colors',
                  active ? 'text-ink' : 'text-ink-soft hover:text-ink',
                )}
              >
                {item.label}
                <span
                  className={cn(
                    'absolute -bottom-0.5 left-0 h-px w-full origin-left bg-brain transition-transform duration-300 ease-paper',
                    active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                  )}
                />
              </Link>
            )
          })}
          <Link
            href={cta.href}
            className="rounded-full bg-ink px-5 py-2.5 font-mono text-telemetry uppercase tracking-[0.1em] text-paper transition-transform duration-300 ease-paper hover:-translate-y-0.5 hover:shadow-card"
          >
            {cta.label}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpenFor(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="flex h-10 w-10 items-center justify-center md:hidden"
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <span className="relative block h-3 w-5" aria-hidden="true">
            <span
              className={cn(
                'absolute left-0 block h-px w-full bg-ink transition-all duration-300 ease-paper',
                open ? 'top-1.5 rotate-45' : 'top-0',
              )}
            />
            <span
              className={cn(
                'absolute left-0 block h-px w-full bg-ink transition-all duration-300 ease-paper',
                open ? 'top-1.5 -rotate-45' : 'top-3',
              )}
            />
          </span>
        </button>
      </nav>

      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-line bg-paper px-[var(--gutter)] py-6 md:hidden"
      >
        <ul className="flex flex-col gap-5">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="font-display text-display-sm text-ink"
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="pt-2">
            <Link
              href={cta.href}
              className="inline-block rounded-full bg-ink px-5 py-3 font-mono text-telemetry uppercase tracking-[0.1em] text-paper"
            >
              {cta.label}
            </Link>
          </li>
        </ul>
      </div>
    </header>
  )
}
