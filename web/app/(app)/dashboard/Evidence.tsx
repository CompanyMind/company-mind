'use client'

import type { Dictionary } from '@/lib/i18n'
import type { Cite } from './Message'

/**
 * Evidence — the quoted passage an answer rests on.
 *
 * This is the product. Everything else here is a chat interface anyone could
 * build; the reason a regulated firm pays is that a claim arrives attached to
 * the sentence it came from. So the quote is set as the loudest thing in the
 * card and is never behind a click — it used to be, which meant the one
 * differentiating element of the whole product was invisible by default and the
 * citation read as a 0.7rem grey footnote.
 *
 * One card, two homes: the rail on a wide screen, and inline under the answer
 * everywhere else. Never both at once — see Message.tsx / AskChat.tsx.
 */
export function EvidenceCard({
  cite,
  active,
  onActivate,
  onHover,
  dict,
  headerRef,
}: {
  cite: Cite
  /** This source is the one being pointed at, from either direction. */
  active: boolean
  onActivate: () => void
  onHover: (marker: number | null) => void
  dict: Dictionary['chat']
  /** CitationHint's anchor — set only on the first card of the first cited
   *  answer, and only in the inline list (the rail is xl-only, and a hint
   *  pointed at a display:none node measures 0x0 and lands in the corner). */
  headerRef?: (el: HTMLButtonElement | null) => void
}) {
  return (
    <li
      onMouseEnter={() => onHover(cite.marker)}
      onMouseLeave={() => onHover(null)}
      data-active={active}
      className="group/cite rounded-lg border border-line bg-paper-raised p-3 transition-colors data-[active=true]:border-brain"
    >
      <button
        type="button"
        ref={headerRef}
        onClick={onActivate}
        className="flex w-full items-center gap-2 text-left"
      >
        {/* The same numeral, in the same accent, as the marker in the prose.
            It is the only thing binding claim to proof, so it must be
            unmistakably the same object in both places. */}
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--brain)_18%,transparent)] font-mono text-[0.6875rem] text-brain-text">
          {cite.marker}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
          {cite.filename}
          {cite.page ? ` · p.${cite.page}` : ''}
        </span>
      </button>

      {/* The hero. A real sentence from a real document, set to be read. */}
      <blockquote className="mt-2 border-l-2 border-brain pl-3 text-body-sm leading-[1.7] text-ink">
        {cite.snippet}
      </blockquote>

      {cite.chunkId ? (
        <a
          href={`/s/${cite.chunkId}`}
          target="_blank"
          rel="noopener"
          className="mt-2 inline-flex items-center gap-1 text-body-sm text-ink-soft underline underline-offset-2 hover:text-brain-text"
        >
          {dict.openSource}
          <span aria-hidden="true">↗</span>
        </a>
      ) : (
        // The chunk was re-ingested, so the passage no longer has an address.
        // The words above are still exactly what was quoted at the time, which
        // is why the citation survives at all (see citations.chunkId,
        // ON DELETE SET NULL) — say that rather than offering a dead link.
        <p className="mt-2 text-body-sm text-ink-soft">{dict.sourceReindexed}</p>
      )}
    </li>
  )
}

/** The stack of cards, shared by the rail and the inline fallback. */
export function EvidenceList({
  citations,
  openMarker,
  onActivate,
  onHover,
  dict,
  className = '',
  firstCardRef,
}: {
  citations: Cite[]
  openMarker: number | null
  onActivate: (marker: number) => void
  onHover: (marker: number | null) => void
  dict: Dictionary['chat']
  className?: string
  firstCardRef?: (el: HTMLButtonElement | null) => void
}) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {citations.map((c, i) => (
        <EvidenceCard
          key={c.marker}
          cite={c}
          headerRef={i === 0 ? firstCardRef : undefined}
          active={openMarker === c.marker}
          onActivate={() => onActivate(c.marker)}
          onHover={onHover}
          dict={dict}
        />
      ))}
    </ul>
  )
}

/**
 * The rail. One per thread, not one per answer.
 *
 * A rail per message would stack down the right edge, each misaligned with the
 * answer it belongs to and each leaving a column of whitespace after a short
 * reply. Instead there is a single rail showing the *active* answer's evidence:
 * the newest by default, or whichever answer you last pointed at. Only mounted
 * at xl and above, where the layout genuinely has the room — below that the
 * chat measure alone (46rem) already exceeds the content area.
 */
export function EvidenceRail({
  citations,
  openMarker,
  onActivate,
  onHover,
  hasAnswer,
  uncited,
  dict,
}: {
  citations: Cite[]
  openMarker: number | null
  onActivate: (marker: number) => void
  onHover: (marker: number | null) => void
  /** Whether the thread has produced an answer yet at all. */
  hasAnswer: boolean
  /** The active answer claimed sources that resolve to nothing. */
  uncited: boolean
  dict: Dictionary['chat']
}) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-line bg-paper-sunk xl:flex">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
          {dict.sources}
          {citations.length > 0 && ` · ${citations.length}`}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {citations.length > 0 ? (
          <EvidenceList
            citations={citations}
            openMarker={openMarker}
            onActivate={onActivate}
            onHover={onHover}
            dict={dict}
          />
        ) : (
          <p className="px-1 py-2 text-body-sm text-ink-soft">
            {/* Three genuinely different states, and conflating them would be
                the same dishonesty the [n] markers were guilty of: nothing
                asked yet, answered from nothing, answered without needing a
                document at all. */}
            {!hasAnswer ? dict.evidenceIdle : uncited ? dict.uncited : dict.evidenceNone}
          </p>
        )}
      </div>
    </aside>
  )
}
