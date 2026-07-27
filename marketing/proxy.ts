import { NextResponse, type NextRequest } from 'next/server'
import { LOCALE_COOKIE, defaultLocale, isLocale } from '@/i18n/config'

/**
 * ============================================================================
 * LOCALE ROUTING — every page URL carries its language.
 * ============================================================================
 * `proxy.ts` is Next 16's name for what used to be `middleware.ts`. It runs
 * before any route renders, and it is deployed separately from the app, so it
 * imports the locale list and nothing else — never a dictionary, never a
 * component. See `i18n/config.ts`.
 *
 * ONE JOB: if the path does not already start with a supported locale, send the
 * visitor to the one that does.
 *
 *     /            -> /uz
 *     /pricing     -> /uz/pricing
 *     /fr/pricing  -> /uz/fr/pricing  (and 404s there, correctly — "fr" is not
 *                                      a language we have, so it is just a path)
 *     /ru/pricing  -> untouched
 *
 * WHY NOT ACCEPT-LANGUAGE: because "Uzbek is the default" is a decision, and a
 * browser header is not. Negotiating on `Accept-Language` would mean a visitor
 * in Tashkent with an English-configured laptop never sees the Uzbek site, and
 * that the same URL serves different content to different people — which breaks
 * CDN caching and makes what a crawler indexed depend on which header it sent.
 * A returning visitor who PICKED a language gets it back from the cookie the
 * switcher writes; everyone else gets the default. Both are explicit.
 *
 * 307, not 308: the choice of default locale is a product decision that could
 * change, and a permanent redirect is cached by browsers essentially forever.
 */

/**
 * Skips API routes, Next internals, and anything with a file extension. That
 * last clause is what keeps `sitemap.xml`, `robots.txt` and `icon.svg` at their
 * exact paths — they are single-URL resources by specification, and a crawler
 * asks for `/robots.txt`, never `/uz/robots.txt`.
 *
 * The OG card is NOT in this list: it lives at `/<locale>/opengraph-image`, so
 * it already carries a prefix and the proxy passes it straight through.
 */
export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Already addressed correctly — return nothing at all rather than
  // `NextResponse.next()`. Handing back a response here would put the proxy in
  // the request path for every prerendered page for no benefit.
  const firstSegment = pathname.split('/')[1]
  if (isLocale(firstSegment)) return

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale

  const url = request.nextUrl.clone()
  // `/` must become `/uz`, not `/uz/` — a trailing slash is a second URL for
  // the same page and Next would redirect again to shed it.
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
  return NextResponse.redirect(url, 307)
}
