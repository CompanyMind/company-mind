import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { Space_Grotesk, IBM_Plex_Mono, Inter, Manrope } from 'next/font/google'
import { brand } from '@/content/brand'
import { getDictionary } from '@/content/dictionaries'
import { ROUTES } from '@/content/routes'
import { alternatesFor, absoluteUrl } from '@/lib/metadata'
import { isLocale, localeTags, locales } from '@/i18n/config'
import '../globals.css'

/**
 * THE ROOT LAYOUT — it lives under `[locale]` on purpose.
 *
 * `<html lang>` has to be the visitor's language: it is what a screen reader
 * switches pronunciation on, what a browser offers to translate from, and what
 * hyphenation uses. A layout at `app/layout.tsx` cannot know the locale —
 * layouts only receive params from segments at or below themselves — so it
 * would have to hard-code one language for all three. Next supports the root
 * layout living inside a top-level dynamic segment for exactly this case.
 *
 * The consequence to know about: there is no `app/layout.tsx`, so every
 * renderable route must sit under `[locale]`. `proxy.ts` guarantees that by
 * prefixing anything that arrives without a locale.
 */

// Display — a confident wide grotesque. Massive scale, tight tracking. No serifs.
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-display',
})

/**
 * Space Grotesk HAS NO CYRILLIC. Without a second display face, every Russian
 * headline would silently fall back to system-ui — a different face at a
 * different width, on the one element that IS the design. Manrope is the
 * closest semi-geometric grotesque that ships Cyrillic.
 *
 * It costs the other two locales nothing. The fallback is per-glyph via
 * `unicode-range`: a page with no Cyrillic on it never downloads the file, and
 * a Latin word inside a Russian sentence still renders in Space Grotesk. The
 * stack order is set in tailwind.config.ts and globals.css.
 */
const displayCyrillic = Manrope({
  subsets: ['cyrillic', 'latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-display-cyrillic',
})

// Mono — telemetry, file names, labels. NEVER body copy.
const mono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

// Body — a clean neutral that gets out of the way.
const body = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-body',
})

/** All three locales are prerendered; `dynamicParams: false` 404s anything else. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export const dynamicParams = false

export const viewport: Viewport = {
  themeColor: '#F3EEE3',
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)

  return {
    metadataBase: new URL(`https://${brand.domain}`),
    title: {
      default: `${brand.name} — ${t.site.tagline}`,
      template: `%s — ${brand.name}`,
    },
    description: t.site.description,
    keywords: [
      'on-premise AI',
      'enterprise knowledge base',
      'sovereign AI',
      'air-gapped AI',
      'cited answers',
      'regulated industries',
      'data residency',
      'self-hosted knowledge management',
    ],
    authors: [{ name: brand.name }],
    alternates: alternatesFor(locale, ROUTES.home),
    openGraph: {
      type: 'website',
      siteName: brand.name,
      locale: localeTags[locale].replace('-', '_'),
      title: `${brand.name} — ${t.site.tagline}`,
      description: t.site.description,
      url: absoluteUrl(locale, ROUTES.home),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${brand.name} — ${t.site.tagline}`,
      description: t.site.description,
    },
    robots: { index: true, follow: true },
  }
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  return (
    <html
      lang={locale}
      className={`${display.variable} ${displayCyrillic.variable} ${mono.variable} ${body.variable}`}
    >
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  )
}
