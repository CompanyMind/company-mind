/**
 * ============================================================================
 * LOCALE CONFIGURATION — the smallest possible module, on purpose.
 * ============================================================================
 * `proxy.ts` runs on every request and is bundled separately from the app, so
 * it must be able to learn the locale list WITHOUT pulling a single word of
 * copy in with it. Nothing in this file may import from `content/`.
 *
 * URLS ARE ALWAYS PREFIXED: /uz, /ru/pricing, /en/security. There is no
 * "invisible default" where `/pricing` silently means Uzbek — that scheme needs
 * a rewrite layer, gives one page two URLs, and makes hreflang a guess. Every
 * page has exactly one address per language and `/` redirects to the default.
 */

export const locales = ['uz', 'ru', 'en'] as const

export type Locale = (typeof locales)[number]

/**
 * Uzbek is the default: an unprefixed URL redirects here, and it is what a
 * visitor with no stored preference gets. Changing this changes where `/` goes.
 */
export const defaultLocale: Locale = 'uz'

/** The cookie the switcher writes, so a returning visitor keeps their choice. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/** One year. A language preference is not a session-scoped thing. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value)
}

/**
 * The name of a language IN that language. Never localized — a Russian speaker
 * looking for their language scans for "Русский", not for "Rus tili".
 */
export const localeNames: Record<Locale, string> = {
  uz: 'Oʻzbekcha',
  ru: 'Русский',
  en: 'English',
}

/** The two-letter form used in the switcher, where there is no room for more. */
export const localeShortNames: Record<Locale, string> = {
  uz: 'UZ',
  ru: 'RU',
  en: 'EN',
}

/** BCP-47 tags for `<html lang>`, hreflang and OpenGraph. */
export const localeTags: Record<Locale, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
}

/**
 * A content path (`/pricing`, `/`) to a real URL for a locale (`/ru/pricing`,
 * `/ru`). Every href in `content/` is stored unprefixed and passed through
 * here at render time, so a route lives in exactly one place and cannot drift
 * between languages.
 */
export function localePath(locale: Locale, path: string): string {
  if (path === '/') return `/${locale}`
  return `/${locale}${path}`
}

/**
 * The inverse: strip a locale prefix off a real pathname, giving the content
 * path back. Used by the switcher, which has to answer "the same page, in the
 * other language" from nothing but `usePathname()`.
 */
export function stripLocale(pathname: string): string {
  const segments = pathname.split('/')
  // ['', 'ru', 'pricing'] — segment 1 is the locale when there is one.
  if (isLocale(segments[1])) {
    const rest = segments.slice(2).join('/')
    return rest ? `/${rest}` : '/'
  }
  return pathname || '/'
}
