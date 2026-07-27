import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HomeExperience } from '@/components/HomeExperience'
import { getDictionary } from '@/content/dictionaries'
import { ROUTES } from '@/content/routes'
import { pageLocation } from '@/lib/metadata'
import { isLocale } from '@/i18n/config'

// Server Component: it exists to own the metadata and to resolve the
// dictionary. All the motion lives in HomeExperience, which is the client
// boundary — and which takes copy as props, so only one language is shipped.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  return {
    description: t.site.description,
    ...pageLocation(locale, ROUTES.home),
  }
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)

  // `plans` comes from the pricing dictionary rather than a homepage copy of
  // it: two lists would drift, and the one that drifts is always the one on the
  // page people actually read.
  return <HomeExperience locale={locale} copy={t.home} plans={t.pricing.plans} />
}
