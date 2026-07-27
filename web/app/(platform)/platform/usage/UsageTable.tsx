import type { UsageSummary } from '@/lib/usage'

function pct(part: number, whole: number): string {
  if (!whole) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-paper-raised px-4 py-3">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
    </div>
  )
}

export function UsageTable({ summary }: { summary: UsageSummary }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Questions" value={summary.totals.questions} />
        <Stat label="Active users" value={summary.totals.activeUsers} />
        <Stat label="Documents indexed" value={summary.totals.documentsIndexed} />
        <Stat label="Folders" value={summary.totals.folders} />
      </div>

      <p className="mt-4 text-body-sm text-ink-soft">
        <strong className="text-ink">Lexical-empty rate</strong> is the share of questions where the
        keyword half of retrieval came back with nothing and the answer ran on semantic search alone
        — the single most actionable number here, since a high rate for one firm usually means its
        indexing or tokenization needs attention.{' '}
        <strong className="text-ink">Uncited rate</strong> is the share of answers that shipped with
        no source citation at all.
      </p>

      {/* Wide table scrolls inside its own container; the page body never
          scrolls horizontally. */}
      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line bg-paper-sunk font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
              <th className="px-3 py-2">Firm</th>
              <th className="px-3 py-2">Questions</th>
              <th className="px-3 py-2">Active users</th>
              <th className="px-3 py-2">Documents</th>
              <th className="px-3 py-2">Folders</th>
              <th className="px-3 py-2">Lexical-empty</th>
              <th className="px-3 py-2">Uncited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {summary.workspaces.map((w) => (
              <tr key={w.workspaceId}>
                <td className="px-3 py-2 text-ink">{w.name}</td>
                <td className="px-3 py-2 text-ink-soft">{w.questions}</td>
                <td className="px-3 py-2 text-ink-soft">{w.activeUsers}</td>
                <td className="px-3 py-2 text-ink-soft">{w.documentsIndexed}</td>
                <td className="px-3 py-2 text-ink-soft">{w.folders}</td>
                <td className="px-3 py-2 text-ink-soft">{pct(w.lexicalArmEmpty, w.questions)}</td>
                <td className="px-3 py-2 text-ink-soft">{pct(w.answerUncited, w.questions)}</td>
              </tr>
            ))}
            {summary.workspaces.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-soft">
                  No activity in this window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
