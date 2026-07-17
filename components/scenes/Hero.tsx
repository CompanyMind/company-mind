'use client'

import { hero } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 1 — HERO
 * The perimeter draws first ("your walls"), then a storm of scattered, tilted,
 * disconnected artifacts inside it. The headline decodes out of noise.
 *
 * The copy never describes the chaos, because the canvas behind it already is
 * the chaos. It states the product and the differentiator instead.
 */
export function Hero() {
  return (
    <section
      data-scene="hero"
      className="relative z-10 flex min-h-dvh flex-col justify-center pb-24 pt-[calc(var(--nav-h)+3rem)]"
    >
      <div className="shell">
        <div className="wash max-w-5xl">
          <p className="mono-label mb-6 animate-fade-in">{hero.eyebrow}</p>

          <h1 className="font-display text-display-xl text-ink">
            {hero.headline.map((line, i) => (
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

          <p className="mt-8 max-w-measure text-lg leading-relaxed text-ink-soft">{hero.sub}</p>
        </div>

        {/* Telemetry boots. This is the site's own instrumentation coming
            online — the same readout the rail holds all the way down. */}
        <div className="mt-12 flex flex-col gap-1 font-mono text-telemetry text-ink-soft">
          <span className="animate-fade-in [animation-delay:600ms]">&gt; system online</span>
          <span className="flex animate-fade-in items-center gap-2 [animation-delay:900ms]">
            &gt; data egress:
            <span className="flex items-center gap-1.5 text-ink">
              <span className="inline-block h-1 w-1 rounded-full bg-brain" aria-hidden="true" />0
              bytes
            </span>
          </span>
        </div>
      </div>

      {/* Quiet scroll cue — a hairline that breathes, not a bouncing chevron. */}
      <div className="shell absolute inset-x-0 bottom-8 flex items-center gap-3">
        <span className="font-mono text-telemetry uppercase tracking-[0.2em] text-ink-soft">
          {hero.scrollCue}
        </span>
        <span className="h-px w-16 origin-left bg-line" aria-hidden="true" />
      </div>
    </section>
  )
}
