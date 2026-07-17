'use client'

import { problem } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 2 — THE PROBLEM
 * Scroll makes the mess WORSE: duplicates multiply, an email sinks and gets
 * buried, a doc greys out and vanishes. The canvas does the arguing; the copy
 * just names what you are watching.
 */
export function Problem() {
  return (
    <section data-scene="problem" className="relative z-10 py-[18vh]">
      <div className="shell">
        <p className="mono-label mb-6">{problem.label}</p>

        <div className="wash max-w-4xl">
          <h2 className="font-display text-display-lg text-ink">
            {problem.headline.map((line) => (
              <span key={line} className="mask-line">
                <DecodeText as="span" text={line} className="block" />
              </span>
            ))}
          </h2>
        </div>

        <p className="plate mt-8 max-w-measure p-5 text-lg leading-relaxed text-ink-soft">
          {problem.body}
        </p>

        <ul className="mt-20 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {problem.beats.map((beat) => (
            <li key={beat.stat} className="bg-paper-raised p-6">
              <h3 className="font-display text-display-sm text-ink">{beat.stat}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{beat.line}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
