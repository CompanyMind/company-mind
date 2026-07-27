'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Dictionary } from '@/lib/i18n'
import { answerComponents, safeUrl, withCitations } from '@/lib/answer-markdown'

export type Cite = {
  marker: number
  chunkId: string | null
  filename: string
  page: number | null
  snippet: string
}

export type Msg = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Cite[]
}

/** Markers the model wrote that resolve to nothing.
 *
 *  The engine drops any `[n]` where n exceeds the number of retrieved passages
 *  (answer.py::resolve_citations), so a model that over-numbers its own answer
 *  leaves markers pointing at sources that were never returned — on production,
 *  answers carrying eight of them and zero citations. Derived here rather than
 *  stored, so it is also true of every answer already in the database. */
export function unresolvedMarkers(msg: Msg): number[] {
  const claimed = new Set(
    (msg.content.match(/\[(\d+)\]/g) ?? []).map((m) => Number(m.slice(1, -1))),
  )
  const real = new Set(msg.citations.map((c) => c.marker))
  return [...claimed].filter((n) => !real.has(n)).sort((a, b) => a - b)
}

/**
 * The answer, as markdown, with `[n]` turned into citation buttons.
 *
 * Two things this does NOT do, both deliberate:
 *
 * 1. It does not print an unresolved marker. It used to fall through and render
 *    the raw `[7]`, which looks exactly like a citation and does nothing — the
 *    worst outcome for a product sold on traceability. Unresolved markers are
 *    removed from the prose and reported once, honestly, below the answer.
 * 2. It does not render raw HTML or images — see lib/answer-markdown.tsx.
 */
function AnswerBody({ msg, onCite }: { msg: Msg; onCite: (m: number) => void }) {
  const real = new Set(msg.citations.map((c) => c.marker))
  const wrap = (children: React.ReactNode) =>
    withCitations(children, (n, key) =>
      real.has(n) ? (
        <button
          key={key}
          onClick={() => onCite(n)}
          className="mx-0.5 inline-flex -translate-y-0.5 items-center rounded-sm bg-[color-mix(in_srgb,var(--brain)_16%,transparent)] px-1 font-mono text-[0.7rem] text-brain-text hover:bg-[color-mix(in_srgb,var(--brain)_28%,transparent)]"
          aria-label={`Source ${n}`}
        >
          {n}
        </button>
      ) : null,
    )

  return (
    <div className="text-body leading-[1.75] text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={answerComponents(wrap)}
      >
        {msg.content}
      </ReactMarkdown>
    </div>
  )
}

/**
 * One turn.
 *
 * A user turn is a bubble; an assistant turn is plain prose on the page — no
 * card, no shadow, no border. The card was what made the pane read as a form
 * rather than a conversation.
 *
 * `whitespace-pre-wrap` on both is new and load-bearing: the composer can
 * produce newlines now (Shift+Enter), and without it a multi-line question
 * collapses into one run-on line.
 */
export function Message({
  msg,
  openMarker,
  onToggleCite,
  onToggleAll,
  onRetry,
  citationAnchorRef,
  dict,
}: {
  msg: Msg
  openMarker: number | null
  onToggleCite: (marker: number) => void
  onToggleAll: () => void
  onRetry?: () => void
  /** Set on the FIRST citation chip of the FIRST cited answer in this chat —
   *  CitationHint positions itself against exactly that node. */
  citationAnchorRef?: (el: HTMLButtonElement | null) => void
  dict: Dictionary['chat']
}) {
  const [copied, setCopied] = useState(false)

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-paper-sunk px-4 py-2.5 text-body text-ink">
          {msg.content}
        </p>
      </div>
    )
  }

  const open = msg.citations.find((c) => c.marker === openMarker) ?? null

  async function copy() {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dead = unresolvedMarkers(msg)

  return (
    <div className="group motion-safe:animate-fade-in">
      <AnswerBody msg={msg} onCite={onToggleCite} />

      {/* The whole product is "every answer cites its source". When that did not
          hold, saying so is the feature — an unbacked answer that looks exactly
          like a backed one is the failure this product exists to prevent, and
          the engine already detects it (answer.py records `answer_uncited`).
          Stated in the reader's language, without apology, and without hiding
          the answer: it may still be useful, it is just not evidence. */}
      {dead.length > 0 && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md border border-query bg-[color-mix(in_srgb,var(--query)_8%,transparent)] px-3 py-2 text-body-sm text-ink"
        >
          <svg
            width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"
            className="mt-0.5 shrink-0 text-query-text"
          >
            <path d="M8 2.5 14.5 13.5h-13z M8 6.5v3M8 11.5h.01" />
          </svg>
          <span>
            {msg.citations.length === 0
              ? dict.uncited
              : dict.partiallyCited.replace('{count}', String(dead.length))}
          </span>
        </p>
      )}

      {msg.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {msg.citations.map((c) => (
            <span key={c.marker} className="inline-flex items-center">
              <button
                ref={c.marker === msg.citations[0].marker ? citationAnchorRef : undefined}
                onClick={() => onToggleCite(c.marker)}
                data-active={openMarker === c.marker}
                className="rounded-l-md border border-line px-2 py-1 font-mono text-[0.7rem] text-ink-soft hover:text-ink data-[active=true]:border-brain data-[active=true]:text-brain-text"
              >
                [{c.marker}] {c.filename}
                {c.page ? ` · p.${c.page}` : ''}
              </button>
              {c.chunkId ? (
                <a
                  href={`/s/${c.chunkId}`}
                  target="_blank"
                  rel="noopener"
                  title="Open source"
                  className="rounded-r-md border border-l-0 border-line px-1.5 py-1 font-mono text-[0.7rem] text-ink-soft hover:border-brain hover:text-brain-text"
                >
                  ↗
                </a>
              ) : (
                <span
                  className="rounded-r-md border border-l-0 border-line px-1.5 py-1 font-mono text-[0.7rem] text-ink-soft"
                  title="The source document has been re-ingested; the quoted text is preserved."
                >
                  ↗
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {open && (
        <figure className="mt-3 rounded-md border-l-2 border-brain bg-paper-raised px-4 py-3">
          <figcaption className="mb-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
            {open.filename}
            {open.page ? ` · page ${open.page}` : ''}
          </figcaption>
          <blockquote className="text-body-sm leading-[1.7] text-ink">{open.snippet}</blockquote>
        </figure>
      )}

      {/* Visible by default; only a device that HAS hover gets to hide them.
          `opacity-0 group-hover:` alone meant Copy, Sources and Retry were
          permanently invisible on every phone and tablet — there is no hover to
          give, so on touch there was no way to copy an answer or open its
          sources at all. The [@media(hover:hover)] variant is the actual
          question being asked; `md:` would have guessed it from width and been
          wrong on every touchscreen laptop. */}
      <div className="mt-2 flex items-center gap-1 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
        <button
          onClick={copy}
          className="rounded-md px-2 py-1 text-body-sm text-ink-soft hover:bg-paper-raised hover:text-ink"
        >
          {copied ? dict.copied : dict.copy}
        </button>
        {msg.citations.length > 0 && (
          <button
            onClick={onToggleAll}
            className="rounded-md px-2 py-1 text-body-sm text-ink-soft hover:bg-paper-raised hover:text-ink"
          >
            {dict.sources}
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md px-2 py-1 text-body-sm text-ink-soft hover:bg-paper-raised hover:text-ink"
          >
            {dict.retry}
          </button>
        )}
      </div>
    </div>
  )
}
