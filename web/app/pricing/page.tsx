import type { Metadata } from 'next'
import { DecodeText } from '@/components/DecodeText'
import { MagneticButton } from '@/components/MagneticButton'
import { StaticBrain } from '@/components/StaticBrain'
import { everyTier, faq, pricingCta, pricingHero, pricingMeta, tiers } from '@/content/pricing'
import { cn } from '@/lib/cn'

/**
 * /pricing — three tiers, no public prices.
 *
 * The page is a Server Component end to end. The only client boundaries are
 * DecodeText (headline reveal) and MagneticButton (cursor lean), both of which
 * already own their own 'use client'. No scroll engine here: a secondary page
 * echoes the calm StaticBrain motif and nothing more.
 *
 * Two rules did the most shaping:
 *  - The empty price slot is the loudest thing on a pricing page. Rather than
 *    "Contact sales", each card states WHAT gets scoped, so the absence reads
 *    as a position instead of a wall.
 *  - The middle tier is emphasized with --brain and a solid ink button.
 *    --sovereign is reserved for the perimeter pulse and the home CTA, so it
 *    appears nowhere on this page — including on the tier literally named
 *    Sovereign, which earns its weight from copy instead.
 */

export const metadata: Metadata = {
  title: pricingMeta.title,
  description: pricingMeta.description,
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

export default function PricingPage() {
  return (
    <>
      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="pb-16 pt-[calc(var(--nav-h)+3.5rem)] sm:pb-24 sm:pt-[calc(var(--nav-h)+6rem)]">
        <div className="shell">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_16rem] lg:gap-20">
            <div>
              <p className="mono-label">{pricingHero.label}</p>
              <h1 className="mt-6 font-display text-display-lg text-ink">
                {pricingHero.headline.map((line, i) => (
                  <DecodeText key={line} as="span" text={line} className="block" delay={i * 110} />
                ))}
              </h1>
              <p className="mt-8 max-w-measure text-lg leading-relaxed text-ink-soft">
                {pricingHero.sub}
              </p>
            </div>
            {/* The resolved brain, at rest. Decorative — aria-hidden inside. */}
            <div className="hidden h-64 w-64 lg:block">
              <StaticBrain />
            </div>
          </div>
        </div>
      </section>

      {/* ---- The three tiers ----------------------------------------------- */}
      <section className="pb-20 sm:pb-28">
        <div className="shell">
          <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-7">
            {tiers.map((tier) => {
              const featured = tier.badge !== null
              return (
                <article
                  key={tier.id}
                  className={cn(
                    'flex h-full flex-col rounded-xl border bg-paper-raised p-7 sm:p-8',
                    featured ? 'border-brain shadow-lift' : 'border-line shadow-card',
                  )}
                >
                  {/* Fixed height so the badge cannot push the featured tier's
                      name out of line with its neighbours. */}
                  <div className="flex h-7 items-center justify-between gap-3">
                    <span className="font-mono text-telemetry uppercase text-ink-soft">
                      {tier.id}
                    </span>
                    {tier.badge ? (
                      <span className="rounded-full bg-brain-text px-3 py-1 font-mono text-telemetry uppercase text-paper-raised">
                        {tier.badge}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-5 font-display text-display-sm text-ink">{tier.name}</h2>

                  <div
                    aria-hidden="true"
                    className={cn('mt-5 h-px w-full', featured ? 'bg-brain' : 'bg-line')}
                  />

                  <p className="mt-5 text-ink-soft">{tier.who}</p>

                  {/* Where the number would go. It says what gets scoped instead. */}
                  <div className="mt-7 rounded-lg border border-line bg-paper-sunk p-5">
                    <p className="mono-label">{tier.priceLabel}</p>
                    <p className="mt-2.5 text-sm leading-relaxed text-ink">{tier.price}</p>
                  </div>

                  <ul className="mt-7 flex-1 space-y-3.5">
                    {tier.features.map((feature) => (
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
                    href={pricingCta.href}
                    variant={featured ? 'ink' : 'quiet'}
                    className="mt-9 w-full"
                  >
                    {tier.cta}
                  </MagneticButton>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---- The constants ------------------------------------------------- */}
      <section className="border-y border-line bg-paper-sunk py-16 sm:py-20">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-20">
            <div>
              <p className="mono-label">{everyTier.label}</p>
              <h2 className="mt-5 font-display text-display-sm text-ink">
                {everyTier.headline.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </h2>
            </div>
            <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {everyTier.items.map((item) => (
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
          <p className="mono-label">{faq.label}</p>
          <h2 className="mt-5 max-w-[18ch] font-display text-display-md text-ink">
            {faq.headline}
          </h2>
          <dl className="mt-14 grid gap-x-14 gap-y-10 md:grid-cols-2">
            {faq.items.map((item) => (
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
            <p className="mono-label">{pricingCta.label}</p>
            <h2 className="mt-5 font-display text-display-md text-ink">
              {pricingCta.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-7 text-lg leading-relaxed text-ink-soft">{pricingCta.body}</p>
            <MagneticButton href={pricingCta.href} className="mt-10">
              {pricingCta.submit}
            </MagneticButton>
            <p className="mt-5 font-mono text-telemetry text-ink-soft">{pricingCta.fineprint}</p>
          </div>
        </div>
      </section>
    </>
  )
}
