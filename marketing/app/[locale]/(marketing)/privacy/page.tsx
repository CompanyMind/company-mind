import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalPage } from '@/components/LegalPage'
import { getDictionary } from '@/content/dictionaries'
import { ROUTES } from '@/content/routes'
import { pageLocation } from '@/lib/metadata'
import { isLocale } from '@/i18n/config'

/**
 * ⚠️ NOT LEGALLY REVIEWED — A LAWYER MUST WRITE THE REAL VERSION BEFORE LAUNCH.
 * This is an honest stub for a pre-launch marketing site: it states only what is
 * true today (a contact form, one language cookie, no analytics, no sale) and
 * invents no jurisdiction, entity, subprocessor, or retention window. See the
 * `legal` block in each content/{uz,ru,en}.ts for what is deliberately missing
 * and why.
 *
 * The claims here are only true while the site stays this small. If anyone adds
 * an analytics snippet, a pixel, an embed, or a font CDN, this page becomes
 * false — fix the copy in the same commit or do not add the script.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const doc = getDictionary(locale).legal.privacy
  return {
    title: doc.title,
    description: doc.description,
    ...pageLocation(locale, ROUTES.privacy),
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const { privacy, meta } = getDictionary(locale).legal
  return <LegalPage doc={privacy} meta={meta} />
}
