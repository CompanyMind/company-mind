import type { MetadataRoute } from 'next'
import { site } from '@/content/site'

/**
 * sitemap.xml — the crawlable surface of the site.
 *
 * Next.js turns the default export into `/sitemap.xml` at build time. The URLs
 * must be absolute, so they are derived from `site.domain` rather than retyped:
 * one source of truth, and the sitemap cannot drift from the metadataBase in
 * app/layout.tsx.
 */

const BASE_URL = `https://${site.domain}`

/**
 * A FIXED date, deliberately not `new Date()`.
 *
 * `<lastmod>` is supposed to mean "when this content last changed" — crawlers
 * use it to decide what to re-fetch. `new Date()` would stamp every route with
 * the build time, so a deploy that only touched CSS would tell Google that all
 * eight pages changed. Bump this by hand when the copy on a route actually
 * changes; it is the honest signal, and honest signals are the whole brand.
 */
const LAST_MODIFIED = new Date('2026-07-17T00:00:00.000Z')

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
  { path: '/', changeFrequency: 'monthly', priority: 1 },
  // /security is level with /product on purpose: for a bank or a hospital, the
  // deployment model is not a detail further down the funnel, it is the gate.
  { path: '/product', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/security', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  // Design-partner recruitment is what the site is FOR, so /contact outranks
  // /about even though /about is the bigger page.
  { path: '/contact', changeFrequency: 'yearly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  // Legal stubs: worth crawling for trust signals, never worth ranking.
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    // Avoid a trailing slash on the root: `https://compbrain.ai`, not `.../`.
    url: path === '/' ? BASE_URL : `${BASE_URL}${path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency,
    priority,
  }))
}
