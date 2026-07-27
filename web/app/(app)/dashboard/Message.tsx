'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n'

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

/** Render answer text with [n] turned into inline citation buttons. */
function AnswerBody({ msg, onCite }: { msg: Msg; onCite: (m: number) => void }) {
  const parts = msg.content.split(/(\[\d+\])/g)
  return (
    <p className="whitespace-pre-wrap text-body leading-[1.75] text-ink">
      {parts.map((p, i) => {
        const m = /^\[(\d+)\]$/.exec(p)
        if (m && msg.citations.some((c) => c.marker === Number(m[1]))) {
          const n = Number(m[1])
          return (
            <button
              key={i}
              onClick={() => onCite(n)}
              className="mx-0.5 inline-flex -translate-y-0.5 items-center rounded-sm bg-[color-mix(in_srgb,var(--brain)_16%,transparent)] px-1 font-mono text-[0.7rem] text-brain-text hover:bg-[color-mix(in_srgb,var(--brain)_28%,transparent)]"
              aria-label={`Source ${n}`}
            >
              {n}
            </button>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </p>
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

  return (
    <div className="group motion-safe:animate-fade-in">
      <AnswerBody msg={msg} onCite={onToggleCite} />

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

      {/* Revealed on hover OR focus-within — never opacity-0 alone, which would
          leave Copy reachable by tab but invisible to the person tabbing. */}
      <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
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
