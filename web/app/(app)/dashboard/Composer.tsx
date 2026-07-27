'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'
import { useTourTarget } from '@/lib/tour/targets'
import { useDocumentUpload } from '@/lib/useDocumentUpload'
import { FileChips, type ChipDoc } from './FileChips'

/** Eight rows, then it scrolls. Past that the composer starts eating the
 *  conversation it is supposed to be part of. */
const MAX_ROWS = 8

export function Composer({
  csrf,
  value,
  onChange,
  onSubmit,
  busy,
  canManage,
  dict,
  onUploaded,
  autoFocus,
}: {
  csrf: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  busy: boolean
  /** Owner. POST /api/documents is getOwner()-gated, so rendering the upload
   *  control to a member would only ever produce a 403 they cannot act on. */
  canManage: boolean
  dict: Dictionary['chat']
  onUploaded?: () => void
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const composerRef = useTourTarget('ask-composer')
  const { upload, busy: uploading, error } = useDocumentUpload(csrf)
  // Attached files, shown as cards inside the box above the input. They stay
  // until the engine finishes indexing (or the reader dismisses them), so the
  // upload is never silent — which is what made it read as broken.
  const [chips, setChips] = useState<ChipDoc[]>([])

  // Grow to fit the content, up to MAX_ROWS. Reset to 'auto' first or
  // scrollHeight only ever reports the current (already grown) height and the
  // box can never shrink back down.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_ROWS)}px`
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // An IME candidate window uses Enter to accept a suggestion. Swallowing it
    // would make the composer unusable for anyone typing a language that needs
    // one, which for a product sold in Uzbekistan and the CIS is not an edge
    // case worth being clever about.
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    try {
      // A card appears the moment the server confirms each file, rather than
      // after the whole batch — with several files that is the difference
      // between watching progress and staring at nothing.
      const n = await upload(files, (doc) =>
        setChips((cs) => (cs.some((c) => c.id === doc.id) ? cs : [...cs, doc])),
      )
      if (n > 0) onUploaded?.()
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Follow each card from uploaded → indexed. Indexing happens in the engine,
  // in the background, so the only way to know it finished is to ask. The
  // interval clears itself once nothing is still pending, so a settled composer
  // costs no polling.
  const pendingIds = chips
    .filter((c) => c.status !== 'indexed' && c.status !== 'failed')
    .map((c) => c.id)
    .join(',')
  useEffect(() => {
    if (!pendingIds) return
    let cancelled = false
    const tick = async () => {
      const r = await fetch('/api/documents')
      if (!r.ok || cancelled) return
      const { documents } = (await r.json()) as { documents: ChipDoc[] }
      const byId = new Map(documents.map((d) => [d.id, d.status]))
      setChips((cs) => cs.map((c) => ({ ...c, status: byId.get(c.id) ?? c.status })))
    }
    const t = setInterval(tick, 2000)
    void tick()
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [pendingIds])

  return (
    <div>
      <form
        ref={composerRef}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="rounded-2xl border border-line-control bg-paper-raised shadow-artifact transition-colors focus-within:border-brain"
      >
        <FileChips
          docs={chips}
          dict={dict}
          onDismiss={(id) => setChips((cs) => cs.filter((c) => c.id !== id))}
        />
        <textarea
          ref={ref}
          rows={1}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={dict.placeholder}
          className="block w-full resize-none bg-transparent px-4 pt-3.5 text-body leading-6 text-ink outline-none placeholder:text-ink-soft"
        />
        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1.5">
          {canManage ? (
            // sr-only, never `hidden`: display:none removes the input from the
            // tab order entirely, so a keyboard-only user could never reach the
            // file chooser (WCAG 2.1 SC 2.1.1, Level A).
            <label
              title={dict.attach}
              className="cursor-pointer rounded-lg p-1.5 text-ink-soft hover:bg-paper-sunk hover:text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brain"
            >
              <span className="sr-only">{dict.attach}</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                {uploading ? <path d="M9 3v3M9 12v3M3 9h3M12 9h3" /> : <path d="M9 4v10M4 9h10" />}
              </svg>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy || !value.trim()}
            aria-label={dict.send}
            className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper transition-opacity disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 13V3M4 6.5 8 2.5l4 4" />
            </svg>
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-body-sm text-sovereign-text">
          {error}
        </p>
      )}
    </div>
  )
}
