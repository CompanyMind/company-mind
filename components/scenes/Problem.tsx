'use client'

import { problem } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 2 — THE PROBLEM.
 *
 * Tall + sticky, so scrolling makes the mess measurably WORSE while the copy
 * holds: duplicates drift apart and multiply, an email sinks to the floor and is
 * buried, a doc greys out and goes. The canvas does the arguing; the copy just
 * names what you are watching.
 */
export function Problem() {
  return (
    <section data-scene="problem" className="relative z-10 py-[12vh] md:h-[200vh] md:py-0">
      <div className="flex items-center md:sticky md:top-0 md:h-dvh">
        <div className="shell w-full">
          <p className="mono-label mb-6">{problem.label}</p>

          <div className="wash max-w-4xl">
            <h2
              className="font-display text-display-lg text-ink"
              aria-label={problem.headline.join(' ')}
            >
              {problem.headline.map((line) => (
                <span key={line} className="mask-line">
                  <DecodeText as="span" text={line} className="block" />
                </span>
              ))}
            </h2>
          </div>

          <p className="mt-7 max-w-measure text-lg leading-relaxed text-ink-soft">{problem.body}</p>

          <ul className="mt-12 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {problem.beats.map((beat) => (
              <li key={beat.stat} className="bg-paper-raised/90 p-5 backdrop-blur-sm">
                <h3 className="font-display text-display-sm text-ink">{beat.stat}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{beat.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
