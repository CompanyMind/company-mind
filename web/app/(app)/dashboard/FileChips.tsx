'use client'

import type { Dictionary } from '@/lib/i18n'

export type ChipDoc = {
  id: string
  filename: string
  /** Mirrors documents.status: uploaded → parsing → indexed | failed. */
  status: string
}

const EXT_LABEL = (filename: string) => (filename.split('.').pop() ?? '').toUpperCase().slice(0, 4)

/**
 * Attached files, as cards inside the composer box above the input — the
 * pattern claude.ai uses. A card carries the file's own name and shows a
 * spinner until the engine has finished indexing it, so "I added something and
 * nothing happened" is not a state that exists any more.
 *
 * These are NOT per-message attachments. A file added here joins the whole
 * workspace's Sources, which is why the card's status line names indexing
 * rather than implying the file is riding along with the next question.
 */
export function FileChips({
  docs,
  onDismiss,
  dict,
}: {
  docs: ChipDoc[]
  onDismiss: (id: string) => void
  dict: Dictionary['chat']
}) {
  if (docs.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-3">
      {docs.map((d) => {
        const pending = d.status !== 'indexed' && d.status !== 'failed'
        const failed = d.status === 'failed'
        return (
          <li
            key={d.id}
            className="flex max-w-[15rem] items-center gap-2.5 rounded-xl border border-line bg-paper px-2.5 py-2"
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-paper-sunk font-mono text-[0.5625rem] tracking-[0.04em] text-ink-soft"
            >
              {pending ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="motion-safe:animate-spin"
                >
                  <circle cx="8" cy="8" r="6" stroke="var(--line)" strokeWidth="2" />
                  <path
                    d="M8 2a6 6 0 0 1 6 6"
                    stroke="var(--brain)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                EXT_LABEL(d.filename)
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body-sm text-ink" title={d.filename}>
                {d.filename}
              </span>
              <span
                className={`block truncate text-[0.75rem] ${failed ? 'text-sovereign-text' : 'text-ink-soft'}`}
              >
                {failed ? dict.uploadFailed : pending ? dict.indexing : dict.indexed}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onDismiss(d.id)}
              aria-label={`${dict.dismissFile}: ${d.filename}`}
              className="ml-auto shrink-0 rounded-md p-1 text-ink-soft hover:bg-paper-sunk hover:text-ink"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
