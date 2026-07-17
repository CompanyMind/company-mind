'use client'

import { sovereign } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 5 — SOVEREIGN BY DESIGN.
 * The perimeter takes centre stage: a hostile packet from OUTSIDE is repelled at
 * the wall, and internal data drifts to the edge and bounces back. Nothing exits,
 * nothing foreign enters — shown by physics, not asserted by a badge.
 *
 * Note the copy discipline: "your data never leaves your infrastructure" (an
 * architectural fact) — never "100% secure" or "unhackable" (unfalsifiable
 * claims that a CISO would rightly discount).
 */
export function Sovereign() {
  return (
    <section data-scene="sovereign" className="relative z-10 py-[18vh]">
      <div className="shell">
        <p className="mono-label mb-6">{sovereign.label}</p>

        <div className="wash max-w-4xl">
          <h2 className="font-display text-display-lg text-ink">
            {sovereign.headline.map((line) => (
              <span key={line} className="mask-line">
                <DecodeText as="span" text={line} className="block" />
              </span>
            ))}
          </h2>
        </div>

        <p className="plate mt-8 max-w-measure p-5 text-lg leading-relaxed text-ink-soft">
          {sovereign.body}
        </p>

        <dl className="mt-20 grid gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-3">
          {sovereign.beats.map((beat) => (
            <div key={beat.label} className="bg-paper-raised p-6">
              <dt className="mono-label">{beat.label}</dt>
              <dd className="mt-3 text-base leading-relaxed text-ink">{beat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
