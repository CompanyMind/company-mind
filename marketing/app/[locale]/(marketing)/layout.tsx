import { notFound } from 'next/navigation'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { SmoothScroll } from '@/components/SmoothScroll'
import { getDictionary } from '@/content/dictionaries'
import { isLocale } from '@/i18n/config'

/**
 * Marketing chrome. Lives in a route group so it wraps only the public pages —
 * the 404 at `app/[locale]/not-found.tsx` sits outside it and inherits the bare
 * root layout instead, exactly as it did before the locale segment existed.
 * URLs are unchanged: route groups do not affect the path.
 *
 * This is where the dictionary is resolved for the chrome. Nav is a client
 * component and takes the strings it needs as props; Footer is a server
 * component and renders here.
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)

  return (
    <>
      <SmoothScroll />
      <a
        href="#main"
        className="sr-only-focusable absolute left-4 top-4 z-[100] rounded-sm bg-ink px-4 py-2 font-mono text-telemetry text-paper"
      >
        {t.skipToContent}
      </a>
      <Nav
        locale={locale}
        items={t.nav}
        cta={t.cta}
        a11y={t.navA11y}
        languageLabel={t.localeSwitcher.label}
      />
      <main id="main">{children}</main>
      <Footer locale={locale} copy={t.footer} />
    </>
  )
}
