import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DecodeText } from '@/components/DecodeText'
import { MagneticButton } from '@/components/MagneticButton'
import { StaticBrain } from '@/components/StaticBrain'
import { getDictionary } from '@/content/dictionaries'
import { ROUTES } from '@/content/routes'
import { pageLocation } from '@/lib/metadata'
import { isLocale, localePath } from '@/i18n/config'
import { cn } from '@/lib/cn'

/**
 * /pricing — three plans, two of them with a printed number.
 *
 * The page is a Server Component end to end. The only client boundaries are
 * DecodeText (headline reveal) and MagneticButton (cursor lean), both of which
 * already own their own 'use client'. No scroll engine here: a secondary page
 * echoes the calm StaticBrain motif and nothing more.
 *
 * Two rules did the most shaping:
 *  - The price slot is the loudest thing on a pricing page. Individual and Team
 *    put a figure in it. Enterprise puts a word there and a sentence underneath
 *    saying what gets scoped, so the absence reads as a position rather than a
 *    wall — an air-gapped rack genuinely is quoted, not listed.
 *  - The middle plan is emphasized with --brain and a solid ink button.
 *    --sovereign is reserved for the perimeter pulse and the home CTA, so it
 *    appears nowhere on this page.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale)
  return {
    title: t.pricing.meta.title,
    description: t.pricing.meta.description,
    ...pageLocation(locale, ROUTES.pricing),
  }
}

/** Accent inks are graphics-only, so the tick is a stroked path — never text. */
function Tick() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="mt-[0.3rem] h-3 w-3 shrink-0">
      <path
        d="M2 6.2 L4.7 9 L10 3"
        fill="none"
        stroke="var(--brain)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale).pricing

  return (
    <>
      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="pb-16 pt-[calc(var(--nav-h)+3.5rem)] sm:pb-24 sm:pt-[calc(var(--nav-h)+6rem)]">
        <div className="shell">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_16rem] lg:gap-20">
            <div>
              <p className="mono-label">{t.hero.label}</p>
              <h1 className="mt-6 font-display text-display-lg text-ink">
                {t.hero.headline.map((line, i) => (
                  <DecodeText key={line} as="span" text={line} className="block" delay={i * 110} />
                ))}
              </h1>
              <p className="mt-8 max-w-measure text-lg leading-relaxed text-ink-soft">
                {t.hero.sub}
              </p>
            </div>
            {/* The resolved brain, at rest. Decorative — aria-hidden inside. */}
            <div className="hidden h-64 w-64 lg:block">
              <StaticBrain />
            </div>
          </div>
        </div>
      </section>

      {/* ---- The three plans ------------------------------------------------ */}
      <section className="pb-14 sm:pb-20">
        <div className="shell">
          <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-7">
            {t.plans.map((plan) => {
              const featured = plan.badge !== null
              return (
                <article
                  key={plan.id}
                  className={cn(
                    'flex h-full flex-col rounded-xl border bg-paper-raised p-7 sm:p-8',
                    featured ? 'border-brain shadow-lift' : 'border-line shadow-card',
                  )}
                >
                  {/* Fixed height so the badge cannot push the featured plan's
                      name out of line with its neighbours. */}
                  <div className="flex h-7 items-center justify-between gap-3">
                    <span className="font-mono text-telemetry uppercase text-ink-soft">
                      {plan.id}
                    </span>
                    {plan.badge ? (
                      <span className="rounded-full bg-brain-text px-3 py-1 font-mono text-telemetry uppercase text-paper-raised">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-5 font-display text-display-sm text-ink">{plan.name}</h2>

                  <div
                    aria-hidden="true"
                    className={cn('mt-5 h-px w-full', featured ? 'bg-brain' : 'bg-line')}
                  />

                  <p className="mt-5 text-ink-soft">{plan.who}</p>

                  {/* The number. `period` is empty on the quoted plan, where
                      "/ month" next to a word would be a lie in a typeface —
                      and where the price is a WORD, set one step smaller. At
                      display-md "Discussed" is eleven characters of the same
                      weight as "$15" and ends up the loudest thing on the page,
                      which is exactly backwards: the two real numbers are what
                      this page is now able to say. */}
                  <div className="mt-7 rounded-lg border border-line bg-paper-sunk p-5">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={cn(
                          'font-display leading-none text-ink',
                          plan.period ? 'text-display-md' : 'text-display-sm',
                        )}
                      >
                        {plan.price}
                      </span>
                      {plan.period ? (
                        <span className="font-mono text-telemetry text-ink-soft">
                          {plan.period}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-soft">{plan.priceNote}</p>
                  </div>

                  <ul className="mt-7 flex-1 space-y-3.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-3 text-sm leading-relaxed text-ink-soft"
                      >
                        <Tick />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <MagneticButton
                    href={localePath(locale, t.cta.href)}
                    variant={featured ? 'ink' : 'quiet'}
                    className="mt-9 w-full"
                  >
                    {plan.cta}
                  </MagneticButton>
                </article>
              )
            })}
          </div>

          {/* Billing terms. Small, but it is the difference between a price and
              a number — currency, cadence, tax, and what is not a contract. */}
          <p className="mt-8 max-w-measure text-sm leading-relaxed text-ink-soft">{t.plansNote}</p>
        </div>
      </section>

      {/* ---- The constants ------------------------------------------------- */}
      <section className="border-y border-line bg-paper-sunk py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-20">
            <div>
              <p className="mono-label">{t.everyTier.label}</p>
              <h2 className="mt-5 font-display text-display-sm text-ink">
                {t.everyTier.headline.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </h2>
            </div>
            <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {t.everyTier.items.map((item) => (
                <div key={item.label}>
                  <dt className="font-mono text-telemetry uppercase text-ink">{item.label}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---- FAQ ------------------------------------------------------------ */}
      <section className="py-20 sm:py-28">
        <div className="shell">
          <p className="mono-label">{t.faq.label}</p>
          <h2 className="mt-5 max-w-[18ch] font-display text-display-md text-ink">
            {t.faq.headline}
          </h2>
          <dl className="mt-14 grid gap-x-14 gap-y-10 md:grid-cols-2">
            {t.faq.items.map((item) => (
              <div key={item.q}>
                <dt className="font-display text-lg text-ink sm:text-xl">{item.q}</dt>
                <dd className="mt-3 max-w-measure leading-relaxed text-ink-soft">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---- Close ----------------------------------------------------------- */}
      <section className="border-t border-line bg-paper-raised py-20 sm:py-28">
        <div className="shell">
          <div className="max-w-measure">
            <p className="mono-label">{t.cta.label}</p>
            <h2 className="mt-5 font-display text-display-md text-ink">
              {t.cta.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-7 text-lg leading-relaxed text-ink-soft">{t.cta.body}</p>
            <MagneticButton href={localePath(locale, t.cta.href)} className="mt-10">
              {t.cta.submit}
            </MagneticButton>
            <p className="mt-5 font-mono text-telemetry text-ink-soft">{t.cta.fineprint}</p>
          </div>
        </div>
      </section>
    </>
  )
}
