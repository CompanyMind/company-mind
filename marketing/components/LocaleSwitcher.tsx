'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  localeNames,
  localeShortNames,
  locales,
  localePath,
  stripLocale,
  type Locale,
} from '@/i18n/config'
import { cn } from '@/lib/cn'

/**
 * UZ · RU · EN.
 *
 * THREE REAL LINKS, not a dropdown and not a client-side state toggle. Each
 * language lives at its own URL, so the honest control for switching is an
 * anchor: it works before hydration, it opens in a new tab on middle-click, and
 * a crawler follows it to the other two versions of the page. A <select> that
 * calls router.push() is the same thing with the affordances removed.
 *
 * It links to THE SAME PAGE in the other language — /ru/pricing from
 * /uz/pricing — rather than dumping the visitor on the homepage, which is the
 * usual bug and the reason people stop using language switchers.
 *
 * The click also writes a cookie, which is the ONLY thing this site stores on a
 * visitor's machine. `proxy.ts` reads it so that a later visit to an unprefixed
 * URL lands in the language they chose instead of the default. Written from the
 * client on click rather than from the server, because a Server Component
 * cannot set a cookie during render.
 */
/**
 * Module scope, not a closure inside the component: the React Compiler lint
 * rules treat an assignment to `document.cookie` from a component body as
 * mutating external state, which is exactly what it is. Hoisting it says the
 * same thing honestly — this is a side effect on the document, not React state.
 *
 * SameSite=Lax so it survives a normal top-level navigation back to the site.
 * No `Secure` flag: localhost is not https, and the flag would make the cookie
 * silently fail to set in development, which is where it gets tested.
 */
function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
}

export function LocaleSwitcher({
  current,
  label,
  className,
}: {
  current: Locale
  /** Accessible name for the group — "Language" / "Til" / "Язык". */
  label: string
  className?: string
}) {
  const pathname = usePathname()
  const path = stripLocale(pathname)

  return (
    <nav aria-label={label} className={cn('flex items-center gap-1', className)}>
      {locales.map((locale, i) => {
        const active = locale === current
        return (
          <span key={locale} className="flex items-center">
            {i > 0 && (
              <span aria-hidden="true" className="px-1 text-telemetry text-line">
                ·
              </span>
            )}
            <Link
              href={localePath(locale, path)}
              hrefLang={locale}
              // The page it points at IS the current page, so a screen reader
              // should say which one is on. `aria-current` is the only honest
              // way to say that — colour alone is not.
              aria-current={active ? 'true' : undefined}
              // The full name is what a person actually recognizes; the visible
              // two letters are an abbreviation of it.
              title={localeNames[locale]}
              onClick={() => rememberLocale(locale)}
              className={cn(
                'rounded-sm px-1 font-mono text-telemetry uppercase tracking-[0.12em] transition-colors',
                active ? 'text-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              <span className="sr-only">{localeNames[locale]}</span>
              <span aria-hidden="true">{localeShortNames[locale]}</span>
            </Link>
          </span>
        )
      })}
    </nav>
  )
}
