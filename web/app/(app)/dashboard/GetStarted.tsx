'use client'

import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n'

export function GetStarted({
  workspaceEmpty,
  suggestions,
  onPick,
  emptyState,
  canManage,
}: {
  workspaceEmpty: boolean
  suggestions: string[]
  onPick: (q: string) => void
  /**
   * Real empty-state copy for the no-documents case — one sentence plus an
   * "Add documents" button, never the numbered "1. Add documents / 2. We
   * sort them / 3. Ask a question" tutorial this branch used to render. That
   * static panel was the founder's own rejected first-run flow (spec §1);
   * see docs/superpowers/specs/2026-07-26-guided-tour-design.md §4
   * "Deliberately not tour steps" for why this is a plain empty state
   * instead of a tour step. Unused when `workspaceEmpty` is false — the
   * starter-suggestions branch below is a genuinely useful empty state on
   * its own and was never part of what got rejected.
   */
  emptyState: Dictionary['emptyStates']['askNoDocuments']
  /**
   * Owner. For a member, `workspaceEmpty` means "no documents YOU can open" —
   * the workspace may be full of documents outside their access groups. So the
   * owner copy ("Upload your first documents") would be both an instruction
   * they cannot follow and a false statement about the workspace.
   */
  canManage: boolean
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center px-6 py-16">
      <h2 className="font-display text-2xl text-ink">
        {workspaceEmpty
          ? canManage
            ? 'Let’s build your brain'
            : 'Nothing you can open yet'
          : 'Ask anything about your documents'}
      </h2>

      {workspaceEmpty ? (
        <>
          <p className="mt-2 text-body text-ink-soft">
            {canManage ? emptyState.body : emptyState.memberBody}
          </p>
          {canManage && (
            <Link
              href="/dashboard/sources"
              className="mt-6 self-start rounded-md bg-ink px-4 py-2 text-body-sm text-paper"
            >
              {emptyState.cta}
            </Link>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-body text-ink-soft">
            Every answer cites the document it came from — click a citation to read the source.
          </p>
          {suggestions.length > 0 && (
            <>
              <p className="mt-6 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
                Try one of these
              </p>
              <ul className="mt-2 space-y-2">
                {suggestions.map((q) => (
                  <li key={q}>
                    <button
                      onClick={() => onPick(q)}
                      className="w-full rounded-lg border border-line bg-paper-raised px-4 py-3 text-left text-body text-ink hover:border-brain"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
