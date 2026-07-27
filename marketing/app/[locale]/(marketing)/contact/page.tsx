import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { StaticBrain } from '@/components/StaticBrain'
import { getDictionary } from '@/content/dictionaries'
import { ROUTES } from '@/content/routes'
import { pageLocation } from '@/lib/metadata'
import { isLocale } from '@/i18n/config'
import { DesignPartnerForm, type FormStatus } from './DesignPartnerForm'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale).contact
  return {
    title: t.meta.title,
    description: t.meta.description,
    // The social title/description go THROUGH the helper — see lib/metadata.ts.
    ...pageLocation(locale, ROUTES.contact, {
      title: t.meta.title,
      description: t.meta.description,
    }),
    // A conversion page has nothing to offer a search index and a bot filling
    // the form helps nobody, but the page must stay crawlable so it can be
    // linked to.
    robots: { index: true, follow: true },
  }
}

/**
 * /contact — design-partner recruitment.
 *
 * Reading order is the argument: state the stage, qualify the reader, tell them
 * exactly what happens after they hit send, then ask. Someone who does not fit
 * should be able to work that out before typing anything. A page that qualifies
 * people OUT is what makes the ones who stay worth the reply.
 *
 * `searchParams.sent` is the no-JS path: the route handler 303s a native form
 * post back here, and the outcome is rendered on the server.
 */
export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale).contact

  const { sent } = await searchParams
  const initialStatus: FormStatus = sent === '1' ? 'sent' : sent === '0' ? 'failed' : 'idle'

  return (
    <div className="pb-28 pt-[calc(var(--nav-h)+4rem)] sm:pb-36 sm:pt-[calc(var(--nav-h)+6rem)]">
      {/* ---- Header ---------------------------------------------------- */}
      <header className="shell">
        <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="mono-label">{t.hero.eyebrow}</p>
            <h1 className="mt-6 font-display text-display-lg text-ink">
              {t.hero.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-8 max-w-measure text-base leading-relaxed text-ink-soft sm:text-lg">
              {t.hero.lede}
            </p>
          </div>

          {/* The calm, resolved motif. No canvas, no scroll engine on a
              secondary page — the SVG says the same thing for free. */}
          <div className="hidden h-56 w-56 shrink-0 md:block lg:h-64 lg:w-64">
            <StaticBrain />
          </div>
        </div>
      </header>

      <hr className="shell mt-16 border-0 border-t border-line sm:mt-20" />

      {/* ---- The argument, then the ask -------------------------------- */}
      <div className="shell mt-16 grid items-start gap-14 sm:mt-20 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          {/* Who this is for */}
          <section aria-labelledby="fit-title">
            <p className="mono-label">{t.fit.label}</p>
            <h2 id="fit-title" className="mt-4 font-display text-display-sm text-ink">
              {t.fit.title}
            </h2>
            <p className="mt-5 max-w-measure text-base leading-relaxed text-ink-soft">
              {t.fit.body}
            </p>

            <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {t.fit.points.map((point) => (
                <li key={point.label} className="bg-paper-raised p-5">
                  <h3 className="font-display text-[1.0625rem] leading-snug text-ink">
                    {point.label}
                  </h3>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-soft">{point.line}</p>
                </li>
              ))}
            </ul>

            <p className="mt-8 max-w-measure border-l-2 border-brain pl-5 text-base leading-relaxed text-ink">
              {t.fit.trade}
            </p>
          </section>

          {/* What happens next */}
          <section aria-labelledby="next-title" className="mt-16 sm:mt-20">
            <p className="mono-label">{t.next.label}</p>
            <h2 id="next-title" className="mt-4 font-display text-display-sm text-ink">
              {t.next.title}
            </h2>

            <ol className="mt-8 flex flex-col gap-5">
              {t.next.steps.map((step) => (
                <li key={step.n} className="flex gap-5">
                  {/* --query is the ink of a question in motion. This is the
                      moment the question starts moving. */}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 font-mono text-telemetry text-query-text"
                  >
                    {step.n}
                  </span>
                  <p className="max-w-measure text-base leading-relaxed text-ink-soft">
                    {step.line}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mt-8 max-w-measure rounded-xl bg-paper-sunk p-5 text-[0.875rem] leading-relaxed text-ink-soft">
              {t.next.promise}
            </p>
          </section>
        </div>

        {/* ---- The form ------------------------------------------------ */}
        <div className="lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:col-span-5">
          <DesignPartnerForm locale={locale} copy={t.form} initialStatus={initialStatus} />
        </div>
      </div>
    </div>
  )
}
