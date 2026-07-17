'use client'

import { sovereign } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 5 — SOVEREIGN BY DESIGN.
 *
 * Tall + sticky, and the one scene where the BRAIN GETS SMALL. The engine
 * shrinks it to r = min(vw,vh) * 0.17 here (brainCfg), so the perimeter — not
 * the brain — owns the frame. The scene is about the walls, so the walls get the
 * space, and the knowledge sits as a small, calm, contained thing in the middle
 * of them.
 *
 * Meanwhile a hostile packet arrives from OUTSIDE, hits the wall, and is thrown
 * back with a crimson ripple. Shown, not asserted.
 *
 * Copy discipline: "your data never leaves your infrastructure" (architectural
 * fact) — never "100% secure" (an unfalsifiable claim a CISO would discount).
 */
export function Sovereign() {
  return (
    <section data-scene="sovereign" className="relative z-10 h-[260vh]">
      <div className="sticky top-0 flex h-dvh items-center">
        <div className="shell w-full">
          <div className="max-w-full lg:max-w-[46%]">
            <p className="mono-label mb-6">{sovereign.label}</p>

            <div className="wash">
              <h2 className="font-display text-display-lg text-ink">
                {sovereign.headline.map((line) => (
                  <span key={line} className="mask-line">
                    <DecodeText as="span" text={line} className="block" />
                  </span>
                ))}
              </h2>
            </div>

            <p className="mt-7 max-w-measure text-lg leading-relaxed text-ink-soft">
              {sovereign.body}
            </p>
          </div>

          <dl className="mt-14 grid gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-3">
            {sovereign.beats.map((beat) => (
              <div key={beat.label} className="bg-paper-raised/90 p-5 backdrop-blur-sm">
                <dt className="mono-label">{beat.label}</dt>
                <dd className="mt-2 text-base leading-relaxed text-ink">{beat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
