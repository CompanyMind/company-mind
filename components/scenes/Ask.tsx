'use client'

import { ask } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 4 — ASK ANYTHING (trust). The crucial moment.
 *
 * A tall section with sticky copy, so the beat can be HELD while the citation
 * lines draw rather than flying past.
 *
 * THE CITATION MECHANIC: each [n] chip carries id="cite-n", and the engine reads
 * that chip's own rect and draws a line from IT — from the exact word you are
 * reading — down to the artifact the clause came from, then fills the chip in
 * when the line lands. Anchoring to the chip rather than to the card's edge is
 * the difference between a citation and a decoration.
 *
 * The engine also dims the whole lattice while these lines are on screen, so
 * they are unambiguously the strongest thing in the frame. That is the brief's
 * instruction, and it is also the product's actual claim.
 *
 * The copy sits LEFT and the brain moves left-of-centre in this scene
 * (brainCfg), leaving the right of the frame as open paper for the lines to
 * travel across. Whitespace here is load-bearing.
 */
export function Ask() {
  return (
    <section data-scene="ask" className="relative z-10 py-[12vh] md:h-[280vh] md:py-0">
      <div className="flex items-center md:sticky md:top-0 md:h-dvh">
        <div className="shell w-full">
          <div className="max-w-full lg:max-w-[52%]">
            <p className="mono-label mb-4">{ask.label}</p>

            <div className="wash">
              <h2
                className="font-display text-display-lg text-ink"
                aria-label={ask.headline.join(' ')}
              >
                {ask.headline.map((line) => (
                  <span key={line} className="mask-line">
                    <DecodeText as="span" text={line} className="block" />
                  </span>
                ))}
              </h2>
            </div>

            <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">{ask.body}</p>

            <div className="mt-6 rounded-sm border border-line bg-paper-raised p-5 shadow-card md:p-6">
              <p className="flex items-start gap-3 font-mono text-telemetry text-query-text">
                <span aria-hidden="true">?</span>
                <span className="leading-relaxed">{ask.question}</span>
              </p>

              <hr className="my-4 border-line" />

              <p className="leading-loose text-ink">
                {ask.answer.map((clause, i) => (
                  <span key={clause.cite}>
                    {clause.text}
                    {/* The engine finds this by id, measures it, and draws from
                        here. It is also a real link to the source, so it works
                        for keyboards and screen readers with no canvas at all. */}
                    <a
                      id={`cite-${clause.cite}`}
                      href={`#source-${clause.cite}`}
                      aria-label={`Source ${clause.cite}: ${ask.sources[i]?.name ?? ''}`}
                      className="mx-1 inline-block rounded-[3px] border border-brain px-1.5 py-px align-middle font-mono text-[0.65rem] font-medium text-brain-text transition-transform hover:scale-110"
                    >
                      {clause.cite}
                    </a>{' '}
                  </span>
                ))}
              </p>

              <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-ink-soft">
                {ask.footnote}
              </p>
            </div>

            <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {ask.sources.map((s) => (
                <li
                  key={s.id}
                  id={`source-${s.id}`}
                  className="flex min-w-0 flex-1 scroll-mt-24 items-start gap-2.5 rounded-sm border border-line bg-paper-raised p-3"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] bg-brain-text font-mono text-[9px] font-medium text-paper">
                    {s.id}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[0.6875rem] text-ink">
                      {s.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.625rem] text-ink-soft">
                      {s.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
