'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Link as LinkCopy, NavA11yCopy } from '@/content/types'
import { localePath, type Locale } from '@/i18n/config'
import { useScrolled } from '@/hooks/useScrolled'
import { LocaleSwitcher } from './LocaleSwitcher'
import { Wordmark } from './Wordmark'
import { cn } from '@/lib/cn'

/**
 * Sticky header. Starts transparent over the hero so the swarm reads edge to
 * edge, then earns a paper backing + hairline once you have scrolled past it.
 *
 * Copy arrives as props from the layout, which resolved the locale. This is a
 * client component (it owns the scroll state and the mobile menu), so importing
 * a dictionary here would ship all three languages to every browser.
 */
export function Nav({
  locale,
  items,
  cta,
  a11y,
  languageLabel,
}: {
  locale: Locale
  items: LinkCopy[]
  cta: LinkCopy
  a11y: NavA11yCopy
  languageLabel: string
}) {
  const pathname = usePathname()
  const scrolled = useScrolled()

  // The menu is open FOR A GIVEN PATH, so navigating closes it for free — no
  // effect mirroring `pathname` into state, and no stale-open menu after a
  // route change (including back/forward, which an onClick handler would miss).
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === pathname

  const home = localePath(locale, '/')

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
        aria-label={a11y.primary}
        className="shell flex h-[var(--nav-h)] items-center justify-between gap-8"
      >
        <Link
          href={home}
          className="text-ink transition-opacity hover:opacity-70"
          aria-label={a11y.home}
        >
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {items.map((item) => {
            const href = localePath(locale, item.href)
            const active = pathname === href
            return (
              <Link
                key={item.href}
                href={href}
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

          {/* Language sits between the sections and the CTA, separated by a
              hairline: it is chrome, not a sixth destination. */}
          <span aria-hidden="true" className="h-4 w-px bg-line" />
          <LocaleSwitcher current={locale} label={languageLabel} />

          <Link
            href={localePath(locale, cta.href)}
            className="rounded-full bg-ink px-5 py-2.5 font-mono text-telemetry uppercase tracking-[0.1em] text-paper transition-transform duration-300 ease-paper hover:-translate-y-0.5 hover:shadow-card"
          >
            {cta.label}
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {/* On a phone the switcher stays OUTSIDE the hamburger. Someone who
              opened the site in a language they do not read cannot be asked to
              find a menu labelled in it. */}
          <LocaleSwitcher current={locale} label={languageLabel} />

          <button
            type="button"
            onClick={() => setOpenFor(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 items-center justify-center"
          >
            <span className="sr-only">{open ? a11y.closeMenu : a11y.openMenu}</span>
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
        </div>
      </nav>

      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-line bg-paper px-[var(--gutter)] py-6 md:hidden"
      >
        <ul className="flex flex-col gap-5">
          {items.map((item) => {
            const href = localePath(locale, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={href}
                  className="font-display text-display-sm text-ink"
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
          <li className="pt-2">
            <Link
              href={localePath(locale, cta.href)}
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
