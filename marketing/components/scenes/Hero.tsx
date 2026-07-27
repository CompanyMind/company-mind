'use client'

import type { HeroCopy } from '@/content/types'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 1 — HERO.
 *
 * Centred, per the reference: the storm fills the whole frame and the copy sits
 * in the middle of it, inside a soft paper wash. That composition says something
 * a left column cannot — the mess is all around you, and the statement is the
 * calm centre of it.
 *
 * The copy never describes the chaos, because the canvas behind it IS the chaos.
 * It states the product and the differentiator in one breath.
 *
 * Fits in exactly one viewport (h-dvh, no overflow) — see the section audit in
 * the README. Every scene owes the reader that.
 */
export function Hero({ copy }: { copy: HeroCopy }) {
  return (
    <section
      data-scene="hero"
      className="relative z-10 grid h-dvh place-items-center overflow-hidden"
    >
      <div className="shell w-full text-center">
        <div className="wash mx-auto max-w-4xl">
          <p className="mono-label mb-5">{copy.eyebrow}</p>

          {/* aria-label carries the true headline; the DecodeText spans inside
              are aria-hidden. One source of truth, no duplicated DOM text. */}
          <h1
            className="font-display text-display-xl text-ink"
            aria-label={copy.headline.join(' ')}
          >
            {copy.headline.map((line, i) => (
              <span key={line} className="mask-line">
                <DecodeText
                  as="span"
                  text={line}
                  delay={i * 190}
                  speed={22}
                  className="block animate-mask-up"
                />
              </span>
            ))}
          </h1>

          <p className="mx-auto mt-7 max-w-measure text-body text-ink-soft">{copy.sub}</p>
        </div>

        {/* Telemetry boots. The site's own instrumentation coming online — the
            same readout the rail holds all the way down. */}
        <div className="mt-10 flex flex-col items-center gap-1 font-mono text-telemetry text-ink-soft">
          <span className="animate-fade-in [animation-delay:600ms]">&gt; {copy.systemOnline}</span>
          <span className="flex animate-fade-in items-center gap-2 [animation-delay:900ms]">
            &gt; {copy.egressLabel}
            <span className="flex items-center gap-1.5 text-ink">
              <span className="inline-block h-1 w-1 rounded-full bg-brain" aria-hidden="true" />
              {copy.egressValue}
            </span>
          </span>
        </div>
      </div>

      {/* Quiet scroll cue — a hairline that breathes, not a bouncing chevron. */}
      <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-3">
        <span className="font-mono text-telemetry uppercase tracking-[0.2em] text-ink-soft">
          {copy.scrollCue}
        </span>
        <span className="h-px w-16 bg-line" aria-hidden="true" />
      </div>
    </section>
  )
}
