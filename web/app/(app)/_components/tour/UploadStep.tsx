'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'
import { useDocumentUpload } from '@/lib/useDocumentUpload'
import { useTourStepControls } from '@/lib/tour/step-controls'

const POLL_MS = 2500

type DocSummary = { status: 'uploaded' | 'parsing' | 'indexed' | 'failed' }

/**
 * The upload-v1 step's entire card body: a real dropzone + file picker,
 * wired to the same `useDocumentUpload` hook Sources.tsx uses
 * (web/lib/useDocumentUpload.ts — extracted in Task 2 for exactly this
 * reuse), plus a live, non-blocking indexing status line.
 *
 * THE RULE THAT MATTERS MOST HERE: the shared "Next" button (rendered by
 * TourCard, gated through web/lib/tour/step-controls.ts) enables the moment
 * `accepted >= 1` — the count of files the server returned HTTP 201 for —
 * and NEVER on indexing completion. Ingestion (parse -> chunk -> embed) runs
 * for minutes on a real corpus; joyride's `before` hook is capped at
 * 5000ms, so gating advance on indexing would time out, register a step
 * failure, and strand the user at a spinner in a card they cannot dismiss.
 * See docs/superpowers/specs/2026-07-26-guided-tour-design.md §4 step 2 and
 * §5. The status line below is informational only — the user may press
 * Next, or walk away, while indexing keeps running.
 */
export function UploadStep({ csrf, dict }: { csrf: string; dict: Dictionary }) {
  const copy = dict.tour.upload
  const { upload, busy, error, accepted } = useDocumentUpload(csrf)
  const { advance, setNextEnabled } = useTourStepControls()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  // How many workspace documents were already `indexed` at the moment this
  // step mounted (or the first successful poll after — see the race note
  // below), subtracted from later polls so the count shown is "indexed
  // since you started this step", not the whole workspace's history — a
  // replayed tour on a workspace with hundreds of existing documents must
  // not show a huge, meaningless number here.
  const baselineIndexed = useRef<number | null>(null)
  const [indexedSinceMount, setIndexedSinceMount] = useState(0)

  // The critical rule, enforced here and only here: Next is gated on
  // `accepted` (HTTP 201s), never on `indexedSinceMount`.
  useEffect(() => {
    setNextEnabled(accepted >= 1)
  }, [accepted, setNextEnabled])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const r = await fetch('/api/documents')
        if (!r.ok || cancelled) return
        const data = (await r.json()) as { documents: DocSummary[] }
        const indexedTotal = data.documents.filter((d) => d.status === 'indexed').length
        // Whichever poll resolves first sets the baseline. In the ordinary
        // case (a human dragging a file in) this is always the very first
        // poll, fired synchronously below, which resolves in tens of
        // milliseconds — long before a person can act. It is only a
        // dev-environment fake-provider corpus, indexed near-instantly,
        // racing an automated click that could beat it; this line is
        // informational only, so that residual risk is accepted rather
        // than adding a blocking wait for the first poll.
        if (baselineIndexed.current === null) baselineIndexed.current = indexedTotal
        if (!cancelled) {
          setIndexedSinceMount(Math.max(0, indexedTotal - baselineIndexed.current))
        }
      } catch {
        // Informational only — spec: "if polling fails, show nothing rather
        // than an error." A broken counter must never block the tour, so
        // failures here are silently swallowed rather than surfaced.
      }
    }
    void poll()
    const id = setInterval(poll, POLL_MS)
    // Stop polling the moment this step unmounts (Next, Back, Escape, or
    // tour end) — a stray 2.5s interval running for the rest of the
    // session is a real bug, not a nit.
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    await upload(files)
    if (inputRef.current) inputRef.current.value = ''
  }

  // Clamped: indexing that isn't from this step's own uploads (rare, see
  // the race note above) must never show more "indexed" than "received".
  const shownIndexed = Math.min(accepted, indexedSinceMount)
  const statusText = copy.status
    .replace('{received}', String(accepted))
    .replace('{indexed}', String(shownIndexed))

  return (
    <div>
      <p>{copy.body}</p>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void onFiles(e.dataTransfer.files)
        }}
        data-drag-over={dragOver}
        // `sr-only` on the input below (not `hidden`/display:none) is
        // load-bearing: a display:none input is pulled out of the tab order
        // entirely, so a keyboard-only user could open a drag surface but
        // never the native file chooser (confirmed live — Tab skipped
        // straight from the card container to "Skip this", never landing
        // here). sr-only keeps it focusable and announced by assistive tech
        // while staying visually hidden; native inputs already open on
        // Enter/Space once focused, so no extra key handling is needed. The
        // has-[:focus-visible] ring on this label is what makes that focus
        // visible, since the input itself is clipped to 1px.
        className="mt-3 block cursor-pointer rounded-md border-2 border-dashed border-line p-6 text-center data-[drag-over=true]:border-brain data-[drag-over=true]:bg-[color-mix(in_srgb,var(--brain)_6%,transparent)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-[color:var(--brain-text)]"
      >
        <p className="text-body-sm text-ink">{copy.dropzone}</p>
        <p className="mt-1 text-body-sm text-ink-soft underline underline-offset-2">
          {busy ? copy.uploading : copy.browse}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void onFiles(e.target.files)}
        />
      </label>
      {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}
      {accepted > 0 && (
        <p className="mt-3 font-mono text-[0.7rem] text-ink-soft">{statusText}</p>
      )}
      <button
        type="button"
        onClick={() => advance()}
        className="mt-3 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        {copy.skipThis}
      </button>
    </div>
  )
}
