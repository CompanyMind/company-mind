'use client'

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'

/**
 * The three stages the ask pipeline actually runs, advanced on elapsed time
 * because the request is one-shot and reports no progress of its own.
 *
 * The labels describe real work in the real order — retrieve, then rerank and
 * read, then generate — and deliberately state no quantities. The client cannot
 * know how many documents were read until the answer lands, and inventing a
 * number in a product whose entire claim is traceability would be indefensible.
 *
 * The last stage never advances: if an answer is slow, "Writing the answer"
 * stays true until it arrives.
 */
const STAGES = ['searching', 'reading', 'writing'] as const
const AT_MS = [0, 1200, 3500]

export function Thinking({ dict }: { dict: Dictionary['chat']['thinking'] }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timers = AT_MS.slice(1).map((ms, i) => setTimeout(() => setStage(i + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <p aria-live="polite" className="flex items-center gap-2 text-body-sm text-ink-soft">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-query motion-safe:animate-heartbeat"
      />
      {dict[STAGES[stage]]}
    </p>
  )
}
