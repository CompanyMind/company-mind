import Link from 'next/link'
import { MagneticButton } from '@/components/MagneticButton'
import { StaticBrain } from '@/components/StaticBrain'
import { nav } from '@/content/site'
import { notFoundCopy } from '@/content/legal'

/**
 * The 404, played straight rather than cute.
 *
 * The metaphor is the product's own rule: an answer needs a source, and this
 * page has none — so it says so and refuses to guess. The composition says the
 * same thing without words: the brain is intact inside its walls, and the thing
 * you asked for is lying outside them, unindexed, with nothing written on it.
 *
 * No metadata export: Next only reads `metadata` from layout/page, so this
 * inherits the root layout's title. Next injects noindex on 404 responses
 * anyway. A dedicated 404 title needs `experimental.globalNotFound` +
 * app/global-not-found.tsx, which touches next.config.ts — not this file's call.
 *
 * Static SVG only. Secondary pages never run the scroll engine.
 */

// Ghost of a document that is not there. Geometry, not copy — hence not in content/.
const GHOST_LINES = ['w-[78%]', 'w-full', 'w-[62%]', 'w-[38%]']

export default function NotFound() {
  const sections = [...nav, notFoundCopy.contactLink]

  return (
    <section className="flex min-h-[100svh] items-center pb-20 pt-[calc(var(--nav-h)+3rem)] md:pb-28">
      <div className="shell grid w-full items-center gap-16 md:grid-cols-[1.05fr_0.95fr] md:gap-10">
        <div>
          <p className="mono-label">{notFoundCopy.label}</p>

          <h1 className="mt-6 font-display text-display-lg text-ink">
            {notFoundCopy.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <p className="mt-8 max-w-measure text-lg leading-relaxed text-ink-soft md:text-xl">
            {notFoundCopy.body}
          </p>
          <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">
            {notFoundCopy.footnote}
          </p>

          <div className="mt-10">
            <MagneticButton href="/">{notFoundCopy.home}</MagneticButton>
          </div>

          <nav aria-label="Sections" className="mt-12 border-t border-line pt-6">
            <p className="mono-label">{notFoundCopy.linksLabel}</p>
            <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
              {sections.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-mono text-telemetry uppercase tracking-[0.12em] text-ink-soft underline decoration-line decoration-1 underline-offset-[6px] transition-colors hover:text-ink hover:decoration-brain"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* The index, at rest inside its walls — and one artifact that never made it in. */}
        <div className="relative mx-auto aspect-square w-full max-w-[17rem] sm:max-w-[21rem]">
          <StaticBrain />

          <figure className="absolute bottom-0 left-0 w-40 -translate-x-2 translate-y-9 -rotate-2 sm:w-44 sm:-translate-x-7 sm:translate-y-10">
            {/* an empty slot: dashed, sunk, nothing resting in it — so no shadow */}
            <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line bg-paper-sunk p-4">
              {GHOST_LINES.map((width) => (
                <span key={width} aria-hidden="true" className={`block h-px bg-line ${width}`} />
              ))}
            </div>
            <figcaption className="mt-4 flex flex-wrap items-baseline gap-x-2 font-mono text-telemetry uppercase tracking-[0.08em] text-ink-soft">
              <span>{notFoundCopy.artifact.caption}</span>
              <span className="text-query-text">{notFoundCopy.artifact.status}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
