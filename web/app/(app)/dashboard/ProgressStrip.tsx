'use client'

import { useState } from 'react'
import type { OnboardingState } from '@/lib/onboarding'

const LABEL: Record<string, string> = {
  add: 'Add documents',
  organise: 'Sort them into folders',
  ask: 'Ask your first question',
}

export function ProgressStrip({ state, csrf }: { state: OnboardingState; csrf: string }) {
  const [hidden, setHidden] = useState(false)
  if (!state.show || hidden) return null

  async function dismiss() {
    setHidden(true)
    await fetch('/api/onboarding/dismiss', { method: 'POST', headers: { 'x-csrf-token': csrf } })
  }

  return (
    <div className="flex items-center gap-4 border-b border-line bg-paper-sunk px-6 py-2">
      <ol className="flex flex-1 flex-wrap items-center gap-4">
        {state.steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-body-sm">
            <span
              aria-hidden="true"
              data-done={s.done}
              className="flex h-4 w-4 items-center justify-center rounded-full border border-line font-mono text-[0.5rem] text-ink-soft data-[done=true]:border-brain data-[done=true]:bg-brain data-[done=true]:text-paper"
            >
              {s.done ? '✓' : i + 1}
            </span>
            <span className={s.done ? 'text-ink-soft line-through' : 'text-ink'}>
              {LABEL[s.key]}
            </span>
          </li>
        ))}
      </ol>
      <button
        onClick={dismiss}
        className="shrink-0 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        Dismiss
      </button>
    </div>
  )
}
