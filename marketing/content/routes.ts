/**
 * ============================================================================
 * ROUTES — every internal path on the site, once.
 * ============================================================================
 * These are NOT copy, so they are not translated. Each locale dictionary
 * imports from here and pairs a path with a translated label:
 *
 *     { href: ROUTES.pricing, label: 'Narxlar' }
 *
 * Triplicating the strings instead would mean a typo in one language produces
 * a broken link only in that language — the kind of bug nobody finds because
 * nobody browses the site in all three.
 *
 * Paths are stored WITHOUT a locale prefix. `localePath()` in i18n/config.ts
 * adds it at render time.
 */

export const ROUTES = {
  home: '/',
  product: '/product',
  security: '/security',
  pricing: '/pricing',
  about: '/about',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
} as const

/** The order the sitemap and the nav both walk. */
export const ROUTE_PATHS = [
  ROUTES.home,
  ROUTES.product,
  ROUTES.security,
  ROUTES.pricing,
  ROUTES.contact,
  ROUTES.about,
  ROUTES.privacy,
  ROUTES.terms,
] as const
