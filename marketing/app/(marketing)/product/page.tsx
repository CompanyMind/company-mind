import type { Metadata } from 'next'
import { Fragment, type ReactNode } from 'react'
import { DecodeText } from '@/components/DecodeText'
import { MagneticButton } from '@/components/MagneticButton'
import { StaticBrain } from '@/components/StaticBrain'
import {
  askDeep,
  ingest,
  organize,
  productClose,
  productHero,
  productMeta,
  type ArtifactKind,
} from '@/content/product'
import { cn } from '@/lib/cn'

export const metadata: Metadata = {
  title: productMeta.title,
  description: productMeta.description,
  openGraph: { title: `${productMeta.title} — CompanyMind`, description: productMeta.description },
}

/* ---------------------------------------------------------------------------
 * Artifact glyphs. The homepage swarm draws eight recognizable artifact kinds;
 * this page echoes the same eight in miniature so a filename in a list and a
 * particle on the canvas are visibly the same species of object.
 *
 * Accent inks appear here as STROKES AND FILLS only — never as text — which is
 * exactly what the contrast law permits them to do.
 * ------------------------------------------------------------------------- */

const SOFT = { stroke: 'var(--ink-soft)', strokeWidth: 1, opacity: 0.5 } as const

const GLYPHS: Record<ArtifactKind, ReactNode> = {
  doc: (
    <>
      <rect x="4.5" y="2.5" width="15" height="19" rx="1.5" />
      <line x1="8" y1="8" x2="16" y2="8" {...SOFT} />
      <line x1="8" y1="12" x2="16" y2="12" {...SOFT} />
      <line x1="8" y1="16" x2="13" y2="16" {...SOFT} />
    </>
  ),
  sheet: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="9" x2="9" y2="20" {...SOFT} />
      <line x1="15" y1="9" x2="15" y2="20" {...SOFT} />
      <line x1="3" y1="14.5" x2="21" y2="14.5" {...SOFT} />
    </>
  ),
  pdf: (
    <>
      <path d="M5 2.5h8.5L19 8v13.5H5z" />
      <path d="M13.5 2.5V8H19" fill="none" />
      <rect x="7.5" y="13" width="9" height="4" rx="0.75" fill="var(--brain)" stroke="none" />
    </>
  ),
  scan: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.5" />
      <line x1="8" y1="7.5" x2="16" y2="7.5" {...SOFT} />
      <line x1="8" y1="16.5" x2="14" y2="16.5" {...SOFT} />
      {/* the beam: --query is a live read in motion. Graphic use only. */}
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="var(--query)" strokeWidth="1.5" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3.8 6.4 12 13l8.2-6.6" fill="none" />
    </>
  ),
  chat: (
    <>
      <path d="M5.5 5.5h13A1.5 1.5 0 0 1 20 7v6.5a1.5 1.5 0 0 1-1.5 1.5H10.5L6 19v-4h-.5A1.5 1.5 0 0 1 4 13.5V7a1.5 1.5 0 0 1 1.5-1.5z" />
      <line x1="7.5" y1="9" x2="16.5" y2="9" {...SOFT} />
      <line x1="7.5" y1="12" x2="13" y2="12" {...SOFT} />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.4" fill="var(--brain)" stroke="none" />
      <path d="M3.5 17 9 12l3.5 3 3-2.5 5 4.5" fill="none" />
    </>
  ),
  audio: (
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="5" />
      <path d="M9 9.5 13.5 12 9 14.5z" fill="var(--brain)" stroke="none" />
      <line x1="15.5" y1="10" x2="15.5" y2="14" />
      <line x1="17.5" y1="9" x2="17.5" y2="15" />
      <line x1="19" y1="10.5" x2="19" y2="13.5" />
    </>
  ),
}

function ArtifactGlyph({ kind, className }: { kind: ArtifactKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('h-5 w-5 shrink-0', className)}
      fill="var(--paper-raised)"
      stroke="var(--brain)"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[kind]}
    </svg>
  )
}

/* ---------------------------------------------------------------------------
 * The citation marker — the strongest mark on the page, and the only filled
 * accent on it.
 *
 * It is a REAL link. `#source-n` jumps to the artifact, the artifact links back
 * to `#cite-n`, and `:target` lights up the card on arrival. No JavaScript, no
 * client component, and it works with a keyboard because it is genuinely a
 * footnote rather than a picture of one.
 *
 * bg-brain-text + text-paper measures 5.52:1 (AA). The raw --brain would have
 * been 3.99 and illegal for text — hence the darkened text-safe token.
 * ------------------------------------------------------------------------- */
function CiteMarker({ n }: { n: number }) {
  return (
    <a
      id={`cite-${n}`}
      href={`#source-${n}`}
      aria-label={`Source ${n}`}
      className={cn(
        // Deliberately the SAME dimensions as the chip on the source card below:
        // the marker and the chip are one object seen twice. em-relative sizing
        // was tried and rejected — it shrank to ~9px in the mobile type size.
        'relative -top-[0.2em] mx-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center',
        'scroll-mt-32 rounded-[3px] bg-brain-text px-1 align-baseline',
        'font-mono text-[0.6875rem] font-medium leading-none text-paper',
        'transition-transform duration-200 ease-paper hover:-translate-y-0.5 hover:shadow-card',
      )}
    >
      {n}
    </a>
  )
}

/**
 * A clause plus the marker that sources it.
 *
 * The marker is glued to the clause's LAST WORD inside a nowrap span. Without
 * this the line can break between "…offshore replica." and its marker, orphaning
 * the marker at the head of the next line where it reads as if it belongs to the
 * following sentence. On a page whose entire argument is "this claim came from
 * that artifact", a citation pointing at the wrong clause is the one typographic
 * bug that cannot be tolerated.
 */
function CitedClause({ text, cite }: { text: string; cite: number }) {
  const words = text.split(' ')
  const last = words.pop() ?? ''
  const head = words.join(' ')
  return (
    <>
      {head ? `${head} ` : ''}
      <span className="whitespace-nowrap">
        {last}
        <CiteMarker n={cite} />
      </span>{' '}
    </>
  )
}

function ChapterHead({
  id,
  chapter,
  label,
  headline,
  body,
  className,
}: {
  /** Anchors the section's aria-labelledby. The real h2 owns it — no sr-only duplicate. */
  id: string
  chapter: string
  label: string
  headline: readonly string[]
  body: string
  className?: string
}) {
  return (
    <header className={cn('max-w-3xl', className)}>
      <div className="flex items-center gap-4">
        <span className="mono-label">Chapter {chapter}</span>
        <span aria-hidden="true" className="h-px w-8 bg-brain" />
        <span className="mono-label text-ink">{label}</span>
      </div>
      <h2 id={id} className="mt-6 text-display-sm text-ink sm:text-display-md">
        {headline.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h2>
      <p className="mt-6 max-w-measure text-base leading-relaxed text-ink-soft sm:text-lg">
        {body}
      </p>
    </header>
  )
}

export default function ProductPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="shell pb-20 pt-[calc(var(--nav-h)+3.5rem)] sm:pb-28 sm:pt-[calc(var(--nav-h)+6rem)]">
        <span className="mono-label">{productHero.eyebrow}</span>

        {/* Full shell width on purpose: each of the three beats has to hold its
            own line. Constrained to a column, "One answer out." wraps and the
            rhythm dies. */}
        <h1 className="mt-5 text-display-md text-ink sm:text-display-lg">
          {productHero.headline.map((line, i) => (
            <DecodeText key={line} as="span" text={line} className="block" delay={i * 110} />
          ))}
        </h1>

        <div className="mt-12 grid gap-12 md:mt-16 md:grid-cols-[1.05fr_0.95fr] md:items-end md:gap-16">
          <div>
            <p className="max-w-measure text-base leading-relaxed text-ink-soft sm:text-lg">
              {productHero.sub}
            </p>

            {/* The page's own table of contents, wearing telemetry clothes. */}
            <div className="mt-9 inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-paper-sunk px-5 py-2.5">
              {productHero.pipeline.map((step, i) => (
                <Fragment key={step}>
                  {i > 0 && (
                    <span aria-hidden="true" className="font-mono text-telemetry text-ink-soft">
                      →
                    </span>
                  )}
                  <span className="font-mono text-telemetry uppercase text-ink-soft">{step}</span>
                </Fragment>
              ))}
            </div>
          </div>

          {/* The calm, resolved motif. Pure SVG — this page runs no engine. */}
          <div className="rounded-lg border border-line bg-paper-raised p-5 shadow-card sm:p-7">
            <StaticBrain className="h-56 w-full sm:h-64" />
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="mono-label">index</span>
              <span className="mono-label">egress: 0 bytes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- INGEST */}
      <section aria-labelledby="ingest-h" className="shell border-t border-line py-20 sm:py-28">
        <ChapterHead
          id="ingest-h"
          chapter={ingest.chapter}
          label={ingest.label}
          headline={ingest.headline}
          body={ingest.body}
        />

        <ul className="mt-14 border-t border-line">
          {ingest.sources.map((source) => (
            <li
              key={source.name}
              className="grid gap-x-10 gap-y-2 border-b border-line py-5 md:grid-cols-[minmax(0,22rem)_1fr]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ArtifactGlyph kind={source.kind} />
                <span className="break-words font-mono text-telemetry text-ink">{source.name}</span>
              </div>
              <p className="max-w-measure text-[0.95rem] leading-relaxed text-ink-soft">
                {source.note}
              </p>
            </li>
          ))}
        </ul>

        {/* Not uppercased: the telemetry voice would render these as ".DOCX" / ".M4A". */}
        <p className="mt-6 font-mono text-telemetry text-ink-soft">{ingest.footnote}</p>
      </section>

      {/* ----------------------------------------------------------- ORGANIZE */}
      <section aria-labelledby="organize-h" className="border-y border-line bg-paper-sunk">
        <div className="shell py-20 sm:py-28">
          <ChapterHead
            id="organize-h"
            chapter={organize.chapter}
            label={organize.label}
            headline={organize.headline}
            body={organize.body}
          />

          {/* gap-px over bg-line: the hairlines ARE the gaps. No double borders. */}
          <div className="mt-14 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
            {organize.beats.map((beat) => (
              <div key={beat.title} className="bg-paper-raised p-6 sm:p-7">
                <h3 className="text-lg text-ink">{beat.title}</h3>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{beat.body}</p>
              </div>
            ))}
          </div>

          {/* Lifted out of the grid: for a regulated buyer this is the whole ballgame. */}
          <div className="mt-8 rounded-md border border-line bg-paper-raised p-6 shadow-card sm:p-9">
            <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:gap-12">
              <div>
                <span className="mono-label">{organize.permission.label}</span>
                <h3 className="mt-4 text-display-sm text-ink">{organize.permission.title}</h3>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
                  {organize.permission.body}
                </p>
              </div>
              <p className="border-l-2 border-brain pl-6 text-lg leading-relaxed text-ink sm:text-xl md:self-center">
                {organize.permission.emphasis}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- ASK */}
      <section aria-labelledby="ask-h" className="shell py-20 sm:py-28">
        <ChapterHead
          id="ask-h"
          chapter={askDeep.chapter}
          label={askDeep.label}
          headline={askDeep.headline}
          body={askDeep.body}
        />

        {/* ---- The centrepiece. Everything above exists to earn this panel. ---- */}
        <div className="mt-14 overflow-hidden rounded-lg border border-line bg-paper-raised shadow-lift">
          <div className="p-6 sm:p-10 md:p-12">
            <span className="mono-label">{askDeep.demo.label}</span>

            {/* --query: a live question moving through. Graphic use — the rule, not the text. */}
            <p className="mt-5 border-l-2 border-query pl-5 text-display-sm text-ink sm:pl-6">
              {askDeep.demo.question}
            </p>

            <div className="mt-12">
              <span className="mono-label">{askDeep.demo.answerLabel}</span>
              <p className="mt-5 max-w-4xl text-lg leading-[1.65] text-ink sm:text-xl sm:leading-[1.6] md:text-2xl md:leading-[1.55]">
                {askDeep.demo.answer.map((clause) => (
                  <CitedClause key={clause.cite} text={clause.text} cite={clause.cite} />
                ))}
              </p>
            </div>
          </div>

          {/* Telemetry rail: counts of what the system did, plus one constant. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-y border-line bg-paper-sunk px-6 py-3 sm:px-10 md:px-12">
            {askDeep.demo.telemetry.map((item) => (
              <span key={item} className="font-mono text-telemetry text-ink-soft">
                {item}
              </span>
            ))}
          </div>

          <div className="p-6 sm:p-10 md:p-12">
            <span className="mono-label">
              {askDeep.demo.sourcesLabel} · {askDeep.demo.sources.length} artifacts
            </span>

            {/* Real footnotes: each marker jumps here, each card jumps back. */}
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {askDeep.demo.sources.map((source) => (
                <li
                  key={source.id}
                  id={`source-${source.id}`}
                  className={cn(
                    'group scroll-mt-28 rounded-md border border-line bg-paper p-4 sm:p-5',
                    'transition-colors duration-300 ease-paper',
                    '[&:target]:border-brain [&:target]:bg-paper-sunk',
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-[3px] bg-brain-text px-1 font-mono text-[0.6875rem] font-medium leading-none text-paper"
                    >
                      {source.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ArtifactGlyph kind={source.kind} className="h-4 w-4" />
                        <span className="break-words font-mono text-telemetry text-ink">
                          {source.name}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-telemetry text-ink-soft">{source.detail}</p>
                      <a
                        href={`#cite-${source.id}`}
                        className="mt-3 inline-flex items-center gap-1.5 font-mono text-telemetry text-brain-text underline decoration-line underline-offset-4 transition-colors hover:decoration-current"
                      >
                        <span aria-hidden="true">↩</span>
                        {askDeep.demo.backLabel} {source.id}
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* The disclaimer that keeps the example an example. */}
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink-soft">
          {askDeep.demo.caption}
        </p>

        {/* ---- Now explain the machine that produced it. ---- */}
        <div className="mt-20 grid gap-12 md:mt-24 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <h3 className="text-display-sm text-ink">{askDeep.pipelineLabel}</h3>
            <p className="mt-5 max-w-measure text-[0.95rem] leading-relaxed text-ink-soft">
              {askDeep.construction}
            </p>
          </div>

          <ol className="border-l border-line">
            {askDeep.pipeline.map((step, i) => (
              <li key={step.title} className="relative py-5 pl-8 first:pt-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -left-[3.5px] h-1.5 w-1.5 rounded-full bg-brain',
                    i === 0 ? 'top-[0.55rem]' : 'top-[1.8rem]',
                  )}
                />
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-telemetry text-ink-soft">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h4 className="font-display text-lg font-bold text-ink">{step.title}</h4>
                </div>
                <p className="mt-2 max-w-measure text-[0.95rem] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* The honest half: what happens when there is nothing to cite. */}
        <div className="mt-16 max-w-2xl rounded-md border border-line bg-paper-raised p-6 shadow-card sm:p-8">
          <h3 className="text-display-sm text-ink">{askDeep.empty.title}</h3>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">{askDeep.empty.body}</p>
        </div>

        <p className="mt-16 max-w-3xl border-l-2 border-brain pl-6 text-display-sm text-ink sm:pl-8">
          {askDeep.footnote}
        </p>
      </section>

      {/* -------------------------------------------------------------- CLOSE */}
      <section
        aria-labelledby="close-h"
        className="border-t border-line bg-paper-sunk py-20 sm:py-28"
      >
        <div className="shell">
          <span className="mono-label">{productClose.label}</span>
          <h2 id="close-h" className="mt-5 text-display-md text-ink sm:text-display-lg">
            {productClose.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="mt-8 max-w-measure text-base leading-relaxed text-ink-soft sm:text-lg">
            {productClose.body}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <MagneticButton href={productClose.primary.href} variant="ink">
              {productClose.primary.label}
            </MagneticButton>
            <MagneticButton href={productClose.secondary.href} variant="quiet">
              {productClose.secondary.label}
            </MagneticButton>
          </div>
        </div>
      </section>
    </>
  )
}
