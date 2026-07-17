import type { Metadata } from 'next'
import { DecodeText } from '@/components/DecodeText'
import { MagneticButton } from '@/components/MagneticButton'
import { StaticBrain } from '@/components/StaticBrain'
import { cta } from '@/content/site'
import { aboutCta, aboutHero, aboutMeta, beliefs, lab, position, stage } from '@/content/about'

export const metadata: Metadata = {
  title: aboutMeta.title,
  description: aboutMeta.description,
}

/**
 * /about — an argument, not a company history.
 *
 * A pre-launch company has no story worth reciting, so this page spends its
 * length on the only thing it genuinely owns: a position, three beliefs, an
 * honest inventory of what it does not have, and the shape of the work.
 *
 * Server Component throughout. The only client islands are DecodeText (the h1
 * reveal) and MagneticButton — both already 'use client'. No scroll engine
 * here: secondary pages echo the motif with the static SVG brain and stop.
 */
export default function AboutPage() {
  return (
    <>
      {/* ---- Hero: the position, in four beats ---- */}
      <section className="border-b border-line">
        <div className="shell grid gap-14 pb-20 pt-[calc(var(--nav-h)+5rem)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-20 lg:pb-28">
          <div>
            <p className="mono-label">{aboutHero.eyebrow}</p>
            <h1 className="mt-6 font-display text-display-lg text-ink">
              {aboutHero.headline.map((line, i) => (
                <DecodeText key={line} as="span" text={line} className="block" delay={i * 110} />
              ))}
            </h1>
            <p className="mt-8 max-w-measure leading-relaxed text-ink-soft sm:text-lg">
              {aboutHero.sub}
            </p>
          </div>
          {/* the calm, resolved brain — decorative echo of the homepage swarm */}
          <div className="hidden w-[clamp(15rem,20vw,20rem)] lg:block">
            <div className="aspect-square">
              <StaticBrain />
            </div>
          </div>
        </div>
      </section>

      {/* ---- The position: why sovereign knowledge infrastructure should exist ---- */}
      <section className="border-b border-line bg-paper-raised py-20 sm:py-28">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] lg:gap-16">
          <p className="mono-label lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:self-start">
            {position.label}
          </p>

          <div>
            <h2 className="font-display text-display-md text-ink">
              {position.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>

            <div className="mt-8 max-w-measure space-y-5 text-ink-soft">
              {position.body.map((para) => (
                <p key={para} className="leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            {/* The ledger: four institutions, and the reason the door is shut.
                Reads as a system record, not a marketing grid. */}
            <div className="mt-12 overflow-hidden rounded-md border border-line bg-paper-sunk">
              <div className="flex items-baseline justify-between gap-6 border-b border-line px-5 py-3">
                <span className="mono-label">{position.ledger.colWho}</span>
                <span className="mono-label">{position.ledger.colWhy}</span>
              </div>
              <dl className="divide-y divide-line">
                {position.ledger.rows.map((row) => (
                  <div
                    key={row.who}
                    className="grid gap-1.5 px-5 py-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6"
                  >
                    <dt className="font-display text-lg tracking-tight text-ink">{row.who}</dt>
                    <dd className="text-sm leading-relaxed text-ink-soft">{row.why}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="mt-12 max-w-measure font-display text-display-sm text-ink">
              {position.closer}
            </p>
            <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">
              {position.closerBody}
            </p>
          </div>
        </div>
      </section>

      {/* ---- Beliefs ---- */}
      <section className="border-b border-line py-20 sm:py-28">
        <div className="shell">
          <p className="mono-label">{beliefs.label}</p>
          <h2 className="mt-6 font-display text-display-md text-ink">
            {beliefs.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>

          {/* gap-px over bg-line draws hairline dividers between cells without
              a border on every child fighting its neighbour */}
          <ol className="mt-14 grid gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-3">
            {beliefs.items.map((item) => (
              <li key={item.n} className="bg-paper-raised p-7 sm:p-9">
                {/* accent AS TEXT must use the darkened -text variant (contrast law) */}
                <span className="font-mono text-telemetry text-brain-text">{item.n}</span>
                <h3 className="mt-5 font-display text-2xl leading-tight tracking-tight text-ink">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Stage: the honest inventory ---- */}
      <section className="border-b border-line bg-paper-sunk py-20 sm:py-28">
        <div className="shell grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="mono-label">{stage.label}</p>
            <h2 className="mt-6 font-display text-display-md text-ink">
              {stage.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-8 max-w-measure leading-relaxed text-ink-soft">{stage.body}</p>
          </div>

          <div>
            <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper-raised shadow-artifact">
              {stage.inventory.map((item) => (
                <li key={item.k} className="px-5 py-5">
                  <p className="font-mono text-telemetry uppercase tracking-[0.14em] text-ink-soft">
                    {item.k}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{item.v}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-measure text-sm leading-relaxed text-ink-soft">{stage.have}</p>
          </div>
        </div>
      </section>

      {/* ---- The lab: roles, never people ---- */}
      <section className="border-b border-line py-20 sm:py-28">
        <div className="shell">
          <div className="max-w-measure">
            <p className="mono-label">{lab.label}</p>
            <h2 className="mt-6 font-display text-display-md text-ink">
              {lab.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-8 leading-relaxed text-ink-soft">{lab.body}</p>
            <p className="mt-5 font-mono text-telemetry uppercase tracking-[0.14em] text-ink-soft">
              {lab.note}
            </p>
          </div>

          {/*
            ┌──────────────────────────────────────────────────────────────────┐
            │  FOUNDER: REAL NAMES GO HERE — and nowhere else on this site.    │
            │                                                                  │
            │  1. Add `name: 'Firstname Lastname'` to the role in             │
            │     content/about.ts (it is optional; roles without one keep     │
            │     rendering the `nameSlot` placeholder).                       │
            │  2. Swap the <span>{role.nameSlot}</span> below for the name.    │
            │                                                                  │
            │  Until a name is real it does not go on this page. No invented   │
            │  people, no placeholder headshots, no initials in a circle.      │
            └──────────────────────────────────────────────────────────────────┘
          */}
          <ul className="mt-14 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
            {lab.roles.map((role) => (
              <li key={role.n} className="bg-paper-raised p-7 sm:p-9">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-telemetry text-brain-text">{role.n}</span>
                  {/* ↓ the name slot — placeholder until a real person fills it */}
                  <span className="font-mono text-telemetry uppercase tracking-[0.12em] text-ink-soft">
                    {role.nameSlot}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-2xl leading-tight tracking-tight text-ink">
                  {role.title}
                </h3>
                <p className="mt-2 font-mono text-telemetry text-ink-soft">{role.focus}</p>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">{role.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section className="py-24 sm:py-32">
        <div className="shell">
          <div className="relative overflow-hidden rounded-lg border border-line bg-paper-raised p-8 shadow-card sm:p-14">
            {/* --sovereign is RARE: the perimeter and its pulse. Graphics only —
                it fails AA as small text, so no copy is ever painted in it. */}
            <span className="absolute inset-x-0 top-0 h-px bg-sovereign" aria-hidden="true" />

            <div className="flex items-center gap-2.5">
              <span
                className="h-1.5 w-1.5 shrink-0 animate-heartbeat rounded-full bg-sovereign"
                aria-hidden="true"
              />
              <p className="mono-label">{aboutCta.label}</p>
            </div>

            <h2 className="mt-6 font-display text-display-md text-ink">
              {aboutCta.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p className="mt-7 max-w-measure leading-relaxed text-ink-soft">{aboutCta.body}</p>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <MagneticButton href={cta.href}>{cta.label}</MagneticButton>
              <p className="font-mono text-telemetry text-ink-soft">{aboutCta.fineprint}</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
