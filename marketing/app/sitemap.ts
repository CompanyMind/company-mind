import type { MetadataRoute } from 'next'
import { brand } from '@/content/brand'
import { ROUTES } from '@/content/routes'
import { defaultLocale, localePath, localeTags, locales } from '@/i18n/config'

/**
 * sitemap.xml — the crawlable surface of the site.
 *
 * Next turns the default export into `/sitemap.xml` at build time. URLs must be
 * absolute, so they are derived from `brand.domain` rather than retyped: one
 * source of truth, and the sitemap cannot drift from the `metadataBase` in the
 * root layout.
 *
 * THREE LANGUAGES, ONE ENTRY EACH, ALL CROSS-LINKED. Every URL carries the full
 * `alternates.languages` map, including a self-reference — that is what the
 * hreflang specification requires, and a set of pages that reference each other
 * asymmetrically is quietly ignored rather than loudly rejected. `x-default`
 * points at the locale an unprefixed URL redirects to.
 */

const BASE_URL = `https://${brand.domain}`

/**
 * A FIXED date, deliberately not `new Date()`.
 *
 * `<lastmod>` is supposed to mean "when this content last changed" — crawlers
 * use it to decide what to re-fetch. `new Date()` would stamp every route with
 * the build time, so a deploy that only touched CSS would tell Google that all
 * eight pages changed. Bump this by hand when the copy on a route actually
 * changes; it is the honest signal, and honest signals are the whole brand.
 */
const LAST_MODIFIED = new Date('2026-07-27T00:00:00.000Z')

type Route = {
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

/**
 * Priority is a relative hint to crawlers about which pages matter most on THIS
 * site — not a ranking lever. It is ordered by what a regulated buyer needs:
 * the pitch, then the two pages that decide whether they can legally buy at
 * all, then commercials, then the conversion target.
 */
const routes: Route[] = [
  // The scroll screenplay — the entire argument in one page.
  { path: ROUTES.home, changeFrequency: 'monthly', priority: 1 },
  // /security is level with /product on purpose: for a bank or a hospital, the
  // deployment model is not a detail further down the funnel, it is the gate.
  { path: ROUTES.product, changeFrequency: 'monthly', priority: 0.9 },
  { path: ROUTES.security, changeFrequency: 'monthly', priority: 0.9 },
  { path: ROUTES.pricing, changeFrequency: 'monthly', priority: 0.8 },
  // Design-partner recruitment is what the site is FOR, so /contact outranks
  // /about even though /about is the bigger page.
  { path: ROUTES.contact, changeFrequency: 'yearly', priority: 0.7 },
  { path: ROUTES.about, changeFrequency: 'monthly', priority: 0.6 },
  // Legal stubs: worth crawling for trust signals, never worth ranking.
  { path: ROUTES.privacy, changeFrequency: 'yearly', priority: 0.3 },
  { path: ROUTES.terms, changeFrequency: 'yearly', priority: 0.3 },
]

function absolute(locale: (typeof locales)[number], path: string) {
  return `${BASE_URL}${localePath(locale, path)}`
}

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.flatMap(({ path, changeFrequency, priority }) => {
    const languages: Record<string, string> = {
      'x-default': absolute(defaultLocale, path),
    }
    for (const l of locales) languages[localeTags[l]] = absolute(l, path)

    return locales.map((locale) => ({
      url: absolute(locale, path),
      lastModified: LAST_MODIFIED,
      changeFrequency,
      priority,
      alternates: { languages },
    }))
  })
}
