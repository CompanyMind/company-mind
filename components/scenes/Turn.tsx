'use client'

import { turn } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 3 — THE TURN. The money shot.
 *
 * A TALL section (320vh) with `position: sticky` copy inside. The copy holds
 * still while ~220vh of scroll accrues underneath it, and the engine reads that
 * as `progress = -rect.top / (height - vh)`. The ingestion therefore advances at
 * exactly the rate the visitor scrolls: they do not watch the mess resolve, they
 * cause it.
 *
 * Native sticky rather than a JS pin. The GSAP version needed a pin-spacer, a
 * refresh cycle, and correct trigger creation order — and getting that order
 * wrong silently broke every scene after it. This cannot break: it is two CSS
 * properties, and the browser does the work.
 *
 * The seal line ("and none of it left your walls") needs no JS either — it is a
 * CSS scroll-driven reveal further down the sticky viewport, so it lands as the
 * ingestion completes.
 */
export function Turn() {
  return (
    <section data-scene="turn" className="relative z-10 h-[320vh]">
      <div className="sticky top-0 grid h-dvh place-items-center">
        <div className="shell w-full">
          <div className="wash mx-auto max-w-4xl text-center">
            <p className="mono-label mb-6">{turn.label}</p>

            <h2 className="font-display text-display-xl text-ink">
              {turn.headline.map((line) => (
                <span key={line} className="mask-line">
                  <DecodeText as="span" text={line} className="block" />
                </span>
              ))}
            </h2>

            <p className="mx-auto mt-8 max-w-measure text-lg leading-relaxed text-ink-soft">
              {turn.body}
            </p>

            {/* Lands with the perimeter's --sovereign flush. -text variant
                because this is TEXT: raw --sovereign is 4.02 and fails AA here. */}
            <p className="mt-10 font-display text-display-sm text-sovereign-text">{turn.seal}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
