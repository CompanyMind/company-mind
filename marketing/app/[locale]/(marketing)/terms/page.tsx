import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalPage } from '@/components/LegalPage'
import { getDictionary } from '@/content/dictionaries'
import { ROUTES } from '@/content/routes'
import { pageLocation } from '@/lib/metadata'
import { isLocale } from '@/i18n/config'

/**
 * ⚠️ NOT LEGALLY REVIEWED — A LAWYER MUST WRITE THE REAL VERSION BEFORE LAUNCH.
 * This is an honest stub for a pre-launch marketing site. It deliberately has no
 * governing law, no entity or registration number, no warranty, no liability
 * cap, no indemnity — inventing any of them would be worse than omitting them.
 *
 * The binding terms live in the deployment agreement, not on this page. If that
 * ever stops being true — a self-serve signup, a download, a trial — these terms
 * are no longer adequate and must be replaced, not extended. Note that the
 * pricing page now prints figures: the copy calls them current intent rather
 * than a locked quote, and that wording is load-bearing.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const doc = getDictionary(locale).legal.terms
  return {
    title: doc.title,
    description: doc.description,
    ...pageLocation(locale, ROUTES.terms),
  }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const { terms, meta } = getDictionary(locale).legal
  return <LegalPage doc={terms} meta={meta} />
}
