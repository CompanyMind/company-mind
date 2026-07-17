'use client'

import { ask } from '@/content/site'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 4 — ASK ANYTHING (trust). The crucial moment.
 *
 * A --query packet enters and the brain answers. Every clause of that answer
 * draws a live line back to the specific artifact it came from — the canvas
 * anchors those lines to [data-cite-anchor] below.
 *
 * Nothing here is asserted without a visible source. That is the product's
 * actual claim, so it is the page's actual behavior.
 *
 * The named files are illustrative examples of a hypothetical customer's OWN
 * documents — the texture of a real contract negotiation. They are not a claim
 * about any real customer, because there are none yet.
 */
export function Ask() {
  return (
    <section data-scene="ask" className="relative z-10 py-[18vh]">
      <div className="shell">
        <p className="mono-label mb-6">{ask.label}</p>

        <div className="wash max-w-4xl">
          <h2 className="font-display text-display-lg text-ink">
            {ask.headline.map((line) => (
              <span key={line} className="mask-line">
                <DecodeText as="span" text={line} className="block" />
              </span>
            ))}
          </h2>
        </div>

        <p className="plate mt-8 max-w-measure p-5 text-lg leading-relaxed text-ink-soft">
          {ask.body}
        </p>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* The answer. This is the anchor the citation lines reach for. */}
          <div
            data-cite-anchor
            className="rounded-sm border border-line bg-paper-raised p-7 shadow-card md:p-9"
          >
            {/* the question, in the query voice */}
            <p className="flex items-start gap-3 font-mono text-telemetry text-query-text">
              <span aria-hidden="true">?</span>
              <span className="leading-relaxed">{ask.question}</span>
            </p>

            <hr className="my-6 border-line" />

            <p className="text-lg leading-loose text-ink">
              {ask.answer.map((clause, i) => (
                <span key={clause.cite}>
                  {clause.text}
                  {/* Citation markers are LINKS to their source, not glyphs.
                      Keyboard-reachable, screen-reader-labelled. */}
                  <a
                    href={`#source-${clause.cite}`}
                    aria-label={`Source ${clause.cite}: ${ask.sources[i]?.name ?? ''}`}
                    className="mx-0.5 inline-flex h-4 w-4 translate-y-[-2px] items-center justify-center rounded-[2px] bg-brain align-middle font-mono text-[9px] font-medium text-paper-raised transition-transform hover:scale-125"
                  >
                    {clause.cite}
                  </a>{' '}
                </span>
              ))}
            </p>

            <p className="mt-7 border-t border-line pt-5 text-sm leading-relaxed text-ink-soft">
              {ask.footnote}
            </p>
          </div>

          {/* The sources themselves — named, typed, locatable. */}
          <div>
            <h3 className="mono-label mb-4">Sources</h3>
            <ul className="flex flex-col gap-2.5">
              {ask.sources.map((s) => (
                <li
                  key={s.id}
                  id={`source-${s.id}`}
                  className="flex scroll-mt-24 items-start gap-3 rounded-sm border border-line bg-paper-raised p-3.5"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] bg-brain font-mono text-[9px] font-medium text-paper-raised">
                    {s.id}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-telemetry text-ink">
                      {s.name}
                    </span>
                    <span className="mt-1 block font-mono text-[0.625rem] text-ink-soft">
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
