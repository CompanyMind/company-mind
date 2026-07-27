'use client'

import Link from 'next/link'
import type { HomePricingCopy, Plan } from '@/content/types'
import { ROUTES } from '@/content/routes'
import { localePath, type Locale } from '@/i18n/config'
import { DecodeText } from '@/components/DecodeText'
import { cn } from '@/lib/cn'

/**
 * SCENE 8 — PRICING.
 *
 * The beat between "here is why it is true" and "let us talk". Proof earns the
 * right to name a number; the ask lands better once the number is already known.
 *
 * IT IS A REAL SCENE, not an ordinary section dropped between two of them.
 * `SwarmEngine.activeScene()` picks the section straddling the viewport centre
 * and falls back to 'hero' when none does — so a plain <section> here would
 * snap the whole composition back to the opening frame for a full viewport of
 * scroll. Adding 'pricing' to `SceneId` costs three lines and removes that
 * entirely. See lib/swarm/types.ts.
 *
 * THE CARDS ARE A SUMMARY, NOT THE PRICE LIST. Three features each, then a link
 * to /pricing for the rest. Showing all eight would overflow the viewport this
 * scene is pinned inside, and a scene that scrolls internally breaks the
 * screenplay. The link says so plainly rather than implying the list is
 * complete.
 *
 * `plans` is the SAME array /pricing renders. One price in two places is how
 * the homepage ends up quietly out of date.
 */
export function Pricing({
  locale,
  copy,
  plans,
}: {
  locale: Locale
  copy: HomePricingCopy
  plans: Plan[]
}) {
  return (
    <section
      data-scene="pricing"
      // Three cards fill the row and the third reaches the bottom-right corner,
      // which is where the telemetry rail lives. The rail fades out while this
      // section is on screen — see components/Telemetry.tsx.
      data-hides-telemetry
      className="relative z-10 py-[12vh] md:h-[190vh] md:py-0"
    >
      <div className="flex items-center md:sticky md:top-0 md:h-dvh">
        <div className="shell w-full">
          <p className="mono-label mb-6">{copy.label}</p>

          {/* Headline LEFT, standfirst RIGHT — not stacked like the other
              scenes. Three price cards are the tallest block on the page, and
              a stacked header pushed the grid down into the telemetry rail in
              the bottom-right corner, which then sat on top of the third
              plan's feature list. Setting the two side by side reclaims ~130px
              and the scene fits its viewport again. */}
          <div className="grid gap-x-14 gap-y-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end">
            <div className="wash">
              <h2
                className="font-display text-display-md text-ink"
                aria-label={copy.headline.join(' ')}
              >
                {copy.headline.map((line) => (
                  <span key={line} className="mask-line">
                    <DecodeText as="span" text={line} className="block" />
                  </span>
                ))}
              </h2>
            </div>

            <div>
              <p className="plate max-w-measure p-5 text-body text-ink-soft">{copy.body}</p>
              <p className="mt-5">
                <Link
                  href={localePath(locale, ROUTES.pricing)}
                  className="inline-flex items-center gap-2 font-mono text-telemetry uppercase tracking-[0.12em] text-ink underline decoration-line decoration-1 underline-offset-[6px] transition-colors hover:decoration-brain"
                >
                  {copy.more}
                  <span aria-hidden="true">→</span>
                </Link>
              </p>
            </div>
          </div>

          <ul className="mt-9 grid items-stretch gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const featured = plan.badge !== null
              return (
                <li
                  key={plan.id}
                  className={cn(
                    'flex flex-col rounded-sm border bg-paper-raised p-6',
                    featured ? 'border-brain shadow-lift' : 'border-line shadow-card',
                  )}
                >
                  {/* Fixed height so the badge cannot push the featured plan's
                      name out of line with its neighbours. */}
                  <div className="flex h-6 items-center justify-between gap-3">
                    <span className="font-mono text-telemetry uppercase text-ink-soft">
                      {plan.id}
                    </span>
                    {plan.badge ? (
                      <span className="rounded-full bg-brain-text px-2.5 py-0.5 font-mono text-telemetry uppercase text-paper-raised">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-3 font-display text-display-sm text-ink">{plan.name}</h3>

                  {/* The number, set as display type. `period` is empty on the
                      quoted plan, whose price is a WORD — set one step smaller
                      so the two real figures stay the loudest thing here. */}
                  <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
                    <span
                      className={cn(
                        'font-display text-ink',
                        plan.period
                          ? 'text-display-sm sm:text-[2rem] sm:leading-none'
                          : 'text-display-sm',
                      )}
                    >
                      {plan.price}
                    </span>
                    {plan.period ? (
                      <span className="font-mono text-telemetry text-ink-soft">{plan.period}</span>
                    ) : null}
                  </p>

                  <p className="mt-3.5 border-t border-line pt-3.5 text-sm leading-relaxed text-ink-soft">
                    {plan.who}
                  </p>

                  <ul className="mt-4 flex-1 space-y-2">
                    {plan.features.slice(0, 3).map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-2.5 text-sm leading-relaxed text-ink-soft"
                      >
                        <Tick />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}

/** Accent inks are graphics-only, so the tick is a stroked path — never text. */
function Tick() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="mt-[0.35rem] h-3 w-3 shrink-0">
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
