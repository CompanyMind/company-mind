import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DecodeText } from '@/components/DecodeText'
import { MagneticButton } from '@/components/MagneticButton'
import { StaticBrain } from '@/components/StaticBrain'
import { getDictionary } from '@/content/dictionaries'
import { ROUTES } from '@/content/routes'
import { pageLocation } from '@/lib/metadata'
import { isLocale, localePath } from '@/i18n/config'

/**
 * /security — the page that decides whether a regulated buyer keeps reading.
 *
 * The whole page is one argument: the security story IS the deployment model.
 * So it is built out of statements the reader can check, not graphics that
 * imply an audit we have never had. There is deliberately no badge row, no
 * shield iconography and no seal — those shapes read as certification whether
 * or not the words next to them claim one.
 *
 * --sovereign appears in exactly two places, both earned: the wall of the data-
 * flow diagram (it IS the perimeter) and the final CTA. Nowhere else.
 *
 * Server component throughout. The only client island is the h1 decode — a
 * marketing subpage does not get a physics engine.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDictionary(locale).security
  return {
    title: t.meta.title,
    description: t.meta.description,
    ...pageLocation(locale, ROUTES.security),
  }
}

/* ---------------------------------------------------------------------------
 * Local primitives. Not exported — nothing else on the site needs them, and a
 * shared component is another agent's file.
 * ------------------------------------------------------------------------- */

function SectionHead({
  label,
  headline,
  body,
}: {
  label: string
  headline: string[]
  body?: string
}) {
  return (
    <>
      <p className="mono-label">{label}</p>
      <h2 className="mt-5 font-display text-display-md text-ink">
        {headline.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h2>
      {body ? (
        <p className="mt-6 max-w-measure text-lg leading-relaxed text-ink-soft">{body}</p>
      ) : null}
    </>
  )
}

/** Flow between stages. Vertical when the diagram stacks, horizontal when it does not. */
function FlowArrow() {
  return (
    <div className="flex items-center justify-center md:self-center" aria-hidden="true">
      <svg viewBox="0 0 40 12" className="h-3 w-7 rotate-90 md:rotate-0" fill="none">
        <line
          x1="1"
          y1="6"
          x2="30"
          y2="6"
          stroke="var(--brain)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M28 1.5 L39 6 L28 10.5 Z" fill="var(--brain)" />
      </svg>
    </div>
  )
}

/**
 * A path across the perimeter that does not exist. The dashed line is the route
 * someone assumes is there; the crossed circle is the architecture answering.
 */
function BlockedPath({ dir }: { dir: 'outbound' | 'inbound' }) {
  const leaving = dir === 'outbound'
  return (
    <svg viewBox="0 0 32 76" className="h-[4.75rem] w-8 shrink-0" fill="none" aria-hidden="true">
      <line
        x1="16"
        y1="0"
        x2="16"
        y2="76"
        stroke="var(--ink-soft)"
        strokeWidth="1.25"
        strokeDasharray="3 4"
        strokeOpacity="0.45"
      />
      {/* which way the attempt is travelling */}
      <path
        d={leaving ? 'M11 11 L16 19 L21 11 Z' : 'M11 65 L16 57 L21 65 Z'}
        fill="var(--ink-soft)"
        fillOpacity="0.45"
      />
      {/* the wall, answering */}
      <circle
        cx="16"
        cy="38"
        r="9.5"
        fill="var(--paper-sunk)"
        stroke="var(--sovereign)"
        strokeWidth="1.75"
      />
      <line
        x1="12.4"
        y1="34.4"
        x2="19.6"
        y2="41.6"
        stroke="var(--sovereign)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <line
        x1="19.6"
        y1="34.4"
        x2="12.4"
        y2="41.6"
        stroke="var(--sovereign)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Allowed / denied mark for the retrieval trace. Brain for a hit, quiet ink for a miss. */
function TraceMark({ ok }: { ok: boolean }) {
  return (
    <svg viewBox="0 0 14 14" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      {ok ? (
        <path
          d="M2.5 7.5 L5.5 10.5 L11.5 3.5"
          stroke="var(--brain)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <g stroke="var(--ink-soft)" strokeWidth="1.75" strokeLinecap="round">
          <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" />
          <line x1="10.5" y1="3.5" x2="3.5" y2="10.5" />
        </g>
      )}
    </svg>
  )
}

/* ---------------------------------------------------------------------------
 * The page
 * ------------------------------------------------------------------------- */

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDictionary(locale)
  const t = dict.security
  const { hero, rail, perimeter, dataflow, directions, permissions, audit, inheritance } = t

  return (
    <>
      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="pb-16 pt-[calc(var(--nav-h)+3.5rem)] md:pb-20 md:pt-[calc(var(--nav-h)+5rem)]">
        <div className="shell grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-20">
          <div>
            <p className="mono-label">{hero.label}</p>
            <h1 className="mt-6 font-display text-display-lg text-ink">
              {hero.headline.map((line, i) => (
                <DecodeText key={line} as="span" text={line} delay={i * 200} className="block" />
              ))}
            </h1>
            <p className="mt-8 max-w-measure text-lg leading-relaxed text-ink-soft">{hero.sub}</p>
          </div>

          {/* The calm, resolved motif. Decoration — the argument is in the type. */}
          <div className="hidden md:block">
            <StaticBrain className="mx-auto max-w-[20rem] lg:max-w-none" />
          </div>
        </div>
      </section>

      {/* ---- Telemetry rail: three facts, true on day one of any deployment -- */}
      <div className="border-y border-line bg-paper-sunk">
        <div className="shell flex flex-wrap items-center gap-x-9 gap-y-2.5 py-4 font-mono text-telemetry text-ink-soft">
          {rail.map((item) => (
            <span key={item.label} className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brain" aria-hidden="true" />
              <span>
                {item.label}: <span className="text-ink">{item.value}</span>
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ---- The perimeter: three deployment modes ------------------------- */}
      <section className="py-20 md:py-28">
        <div className="shell">
          <SectionHead
            label={perimeter.label}
            headline={perimeter.headline}
            body={perimeter.body}
          />
          <ul className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
            {perimeter.modes.map((mode) => (
              <li key={mode.n} className="bg-paper-raised p-7 sm:p-8">
                <p className="font-mono text-telemetry text-brain-text">{mode.n}</p>
                <h3 className="mt-4 font-display text-display-sm text-ink">{mode.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{mode.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- Data flow: the diagram --------------------------------------- */}
      <section className="border-y border-line bg-paper-sunk py-20 md:py-28">
        <div className="shell">
          <SectionHead label={dataflow.label} headline={dataflow.headline} body={dataflow.body} />

          <figure className="mt-14">
            {/* The wall. --sovereign is spent here because this IS the perimeter. */}
            <div className="relative rounded-xl border-2 border-sovereign bg-paper-raised px-4 pb-5 pt-9 sm:px-6 sm:pb-6 sm:pt-10">
              <span className="absolute -top-[0.55rem] left-4 bg-paper-sunk px-2 font-mono text-telemetry uppercase tracking-[0.14em] text-sovereign-text sm:left-6">
                {dataflow.wallLabel}
              </span>

              <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-3">
                {dataflow.stages.map((stage, i) => (
                  <div key={stage.label} className="contents">
                    {i > 0 ? <FlowArrow /> : null}
                    <div className="rounded-lg border border-line bg-paper p-5 shadow-artifact">
                      <p className="mono-label text-brain-text">{stage.label}</p>
                      <h3 className="mt-3 font-display text-lg leading-tight text-ink">
                        {stage.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{stage.line}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* The sink every stage writes to — and it is theirs, not ours. */}
              <div className="mt-3 rounded-lg border border-dashed border-line bg-paper-sunk p-5">
                <p className="mono-label text-brain-text">{dataflow.audit.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{dataflow.audit.line}</p>
              </div>
            </div>

            {/* The two crossings that were never built. */}
            <div className="grid gap-10 sm:grid-cols-2 sm:gap-6">
              {dataflow.barriers.map((barrier) => (
                <div key={barrier.dir} className="flex flex-col items-center text-center">
                  <BlockedPath dir={barrier.dir} />
                  <p className="mono-label font-medium text-ink">{barrier.label}</p>
                  <p className="mt-3 rounded-md border border-dashed border-line bg-paper px-4 py-2.5 font-mono text-telemetry text-ink-soft">
                    {barrier.target}
                  </p>
                  <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-ink-soft">
                    {barrier.note}
                  </p>
                </div>
              ))}
            </div>

            <figcaption className="mx-auto mt-14 max-w-measure text-center text-sm leading-relaxed text-ink-soft">
              {dataflow.caption}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---- The three directions ----------------------------------------- */}
      <section className="py-20 md:py-28">
        <div className="shell">
          <SectionHead
            label={directions.label}
            headline={directions.headline}
            body={directions.body}
          />
          <ol className="mt-14 border-t border-line">
            {directions.items.map((item) => (
              <li
                key={item.label}
                className="grid gap-4 border-b border-line py-10 md:grid-cols-[11rem_1fr] md:gap-10"
              >
                <p className="mono-label pt-1.5 text-brain-text">{item.label}</p>
                <div>
                  <h3 className="font-display text-display-sm text-ink">{item.title}</h3>
                  <p className="mt-4 max-w-measure leading-relaxed text-ink-soft">{item.body}</p>
                  {/* The claim, restated as something the reader can run themselves. */}
                  <p className="mt-6 flex flex-col gap-1.5 border-l-2 border-brain pl-5 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="mono-label shrink-0 text-brain-text">
                      {directions.verifyLabel}
                    </span>
                    <span className="text-sm leading-relaxed text-ink-soft">{item.verify}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Permission-awareness ----------------------------------------- */}
      <section className="border-y border-line bg-paper-raised py-20 md:py-28">
        <div className="shell">
          <SectionHead
            label={permissions.label}
            headline={permissions.headline}
            body={permissions.body}
          />

          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
            <ul className="flex flex-col gap-6">
              {permissions.points.map((point) => (
                <li key={point} className="flex gap-5">
                  <span className="mt-3 h-px w-7 shrink-0 bg-brain" aria-hidden="true" />
                  <span className="leading-relaxed text-ink-soft">{point}</span>
                </li>
              ))}
            </ul>

            {/* A schematic of a filtered retrieval. Illustrative — no customer here. */}
            <div className="self-start rounded-xl border border-line bg-paper p-6 shadow-card sm:p-7">
              <p className="mono-label">{permissions.trace.label}</p>
              <p className="mt-4 border-b border-line pb-4 font-mono text-telemetry text-ink">
                {permissions.trace.asker}
              </p>
              <ul className="mt-4 flex flex-col gap-4">
                {permissions.trace.rows.map((row) => (
                  <li key={row.file} className="flex gap-3">
                    <TraceMark ok={row.ok} />
                    <span className="min-w-0">
                      <span className="block break-all font-mono text-telemetry text-ink">
                        {row.file}
                      </span>
                      <span className="mt-1 block font-mono text-telemetry text-ink-soft">
                        {row.state}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-14 border-l-2 border-brain pl-6 sm:pl-8">
            <p className="max-w-[26ch] font-display text-display-sm text-ink">
              {permissions.close}
            </p>
            <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">
              {permissions.closeNote}
            </p>
          </div>
        </div>
      </section>

      {/* ---- Audit --------------------------------------------------------- */}
      <section className="py-20 md:py-28">
        <div className="shell">
          <SectionHead label={audit.label} headline={audit.headline} body={audit.body} />
          <dl className="mt-14 border-t border-line">
            {audit.rows.map((row) => (
              <div
                key={row.k}
                className="grid gap-2 border-b border-line py-7 md:grid-cols-[14rem_1fr] md:gap-10"
              >
                <dt className="mono-label pt-1 text-ink">{row.k}</dt>
                <dd className="max-w-measure leading-relaxed text-ink-soft">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---- Your controls already apply ----------------------------------- */}
      <section className="border-y border-line bg-paper-sunk py-20 md:py-28">
        <div className="shell">
          <SectionHead
            label={inheritance.label}
            headline={inheritance.headline}
            body={inheritance.body}
          />

          <ul className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {inheritance.rows.map((row) => (
              <li key={row.control} className="bg-paper-raised p-7 sm:p-8">
                <h3 className="mono-label font-medium text-ink">{row.control}</h3>
                <p className="mt-3.5 text-sm leading-relaxed text-ink-soft">{row.line}</p>
              </li>
            ))}
          </ul>

          {/* Frameworks appear ONCE, and only as the reader's own obligations. */}
          <div className="mt-10 rounded-r-lg border-l-2 border-brain bg-paper-raised p-7 sm:p-9">
            <h3 className="mono-label font-medium text-brain-text">
              {inheritance.frameworks.label}
            </h3>
            <p className="mt-4 max-w-[68ch] leading-relaxed text-ink-soft">
              {inheritance.frameworks.body}
            </p>
          </div>
        </div>
      </section>

      {/* ---- What we are not claiming -------------------------------------- */}
      <section className="py-20 md:py-28">
        <div className="shell">
          <SectionHead
            label={t.notClaiming.label}
            headline={t.notClaiming.headline}
            body={t.notClaiming.body}
          />
          <ul className="mt-14 border-t border-line">
            {t.notClaiming.items.map((item) => (
              <li
                key={item.claim}
                className="grid gap-3 border-b border-line py-8 md:grid-cols-[1fr_1.35fr] md:gap-10"
              >
                <h3 className="font-display text-display-sm text-ink">{item.claim}</h3>
                <p className="max-w-measure leading-relaxed text-ink-soft">{item.line}</p>
              </li>
            ))}
          </ul>
          <div className="mt-14 border-l-2 border-brain pl-6 sm:pl-8">
            <p className="max-w-[42ch] font-display text-display-sm text-ink">
              {t.notClaiming.close}
            </p>
            <p className="mt-5 max-w-measure leading-relaxed text-ink-soft">
              {t.notClaiming.closeNote}
            </p>
          </div>
        </div>
      </section>

      {/* ---- CTA — the second and last place --sovereign is allowed --------- */}
      <section className="border-t border-line bg-paper-raised py-24 md:py-32">
        <div className="shell max-w-4xl text-center">
          <p className="mono-label inline-flex items-center gap-2.5">
            <span
              className="inline-block h-1.5 w-1.5 animate-heartbeat rounded-full bg-sovereign"
              aria-hidden="true"
            />
            {t.cta.label}
          </p>
          <h2 className="mt-6 font-display text-display-md text-ink">
            {t.cta.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="mx-auto mt-7 max-w-measure text-lg leading-relaxed text-ink-soft">
            {t.cta.body}
          </p>
          <div className="mt-10 flex justify-center">
            <MagneticButton href={localePath(locale, dict.cta.href)} variant="sovereign">
              {dict.cta.label}
            </MagneticButton>
          </div>
          <p className="mt-6 font-mono text-telemetry text-ink-soft">{t.cta.fineprint}</p>
        </div>
      </section>
    </>
  )
}
