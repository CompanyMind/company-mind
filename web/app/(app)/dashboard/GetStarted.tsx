'use client'

import Link from 'next/link'

export function GetStarted({
  workspaceEmpty,
  suggestions,
  onPick,
}: {
  workspaceEmpty: boolean
  suggestions: string[]
  onPick: (q: string) => void
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center px-6 py-16">
      <h2 className="font-display text-2xl text-ink">
        {workspaceEmpty ? 'Let’s build your brain' : 'Ask anything about your documents'}
      </h2>

      {workspaceEmpty ? (
        <>
          <p className="mt-2 text-body text-ink-soft">
            CompanyMind answers questions from your own documents, and every answer links back to
            the exact page it came from. Nothing leaves your infrastructure.
          </p>
          <ol className="mt-6 space-y-3 text-body text-ink-soft">
            <li>
              <strong className="text-ink">1. Add documents.</strong> PDFs, Word, text or markdown.
            </li>
            <li>
              <strong className="text-ink">2. We sort them into folders</strong> so you can see what
              your workspace actually contains.
            </li>
            <li>
              <strong className="text-ink">3. Ask a question</strong> and get an answer with its
              sources attached.
            </li>
          </ol>
          <Link
            href="/dashboard/sources"
            className="mt-8 self-start rounded-md bg-ink px-4 py-2 text-body-sm text-paper"
          >
            Add documents
          </Link>
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
