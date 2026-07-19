'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Finding = {
  id: string
  kind: string
  documentId: string
  severity: number
  detail: Record<string, unknown>
  filename: string
}

// Maps each map lens toggle to the finding kind(s) it corresponds to in the
// sidebar. 'deadstale' is the one lens that covers two kinds — the map's
// Dead/Stale toggle treats them as a single governance signal.
const LENS_KINDS: Record<string, string[]> = {
  anomaly: ['permission_anomaly'],
  exposure: ['over_exposure'],
  orphan: ['orphan'],
  deadstale: ['dead', 'stale'],
}

// Lens signals get their own semantic colors, deliberately separate from the
// brand violet used for the graph nodes: red for a permission problem, warm
// amber "heat" for over-exposure, muted grey for an orphan, dashed/faded for
// dead or stale. `badge` follows the app's existing color-mix idiom (see
// AccessManager/Sources) rather than Tailwind opacity modifiers, which don't
// work on these tokens (they resolve through CSS vars — see tailwind.config.ts).
const KIND_META: Record<
  string,
  { label: string; badge: string; explain: (f: Finding) => string }
> = {
  permission_anomaly: {
    label: 'Permission anomalies',
    badge: 'border-sovereign bg-[color-mix(in_srgb,var(--sovereign)_8%,transparent)] text-sovereign-text',
    explain: (f) => {
      const d = f.detail as { consensus?: string[]; doc_groups?: string[]; direction?: string }
      const mine = (d.doc_groups ?? []).join(', ') || 'no one'
      const consensus = (d.consensus ?? []).join(', ') || 'no one'
      return d.direction === 'over_shared'
        ? `Shared with ${mine} — wider than the ${consensus} the rest of this topic uses.`
        : `Shared with ${mine} — narrower than the ${consensus} the rest of this topic uses.`
    },
  },
  over_exposure: {
    label: 'Over-exposed',
    badge: 'border-query bg-[color-mix(in_srgb,var(--query)_8%,transparent)] text-query-text',
    explain: () => 'Visible to nearly everyone in the workspace.',
  },
  orphan: {
    label: 'Orphans',
    badge: 'border-line text-ink-soft',
    explain: (f) => {
      const sim = (f.detail as { max_similarity?: number }).max_similarity
      return typeof sim === 'number'
        ? `No closely related document in its topic (best match ${Math.round(sim * 100)}%).`
        : 'No closely related document in its topic.'
    },
  },
  dead: {
    label: 'Dead documents',
    badge: 'border-line border-dashed text-ink-soft',
    explain: () => 'Never returned as a citation in an answer.',
  },
  stale: {
    label: 'Stale documents',
    badge: 'border-line border-dashed text-ink-soft',
    explain: (f) => {
      const age = (f.detail as { age_days?: number }).age_days
      return typeof age === 'number'
        ? `Uploaded ${Math.round(age)} days ago with no recent activity.`
        : 'Aging with no recent activity.'
    },
  },
}

function kindMeta(kind: string) {
  return (
    KIND_META[kind] ?? {
      label: kind,
      badge: 'border-line text-ink-soft',
      explain: () => 'Needs review.',
    }
  )
}

// Every finding kind resolves to the same fix target today: the document's
// row in Sources, where groups are edited (Task 13 makes Sources honor
// `?doc=` by opening that row's editor).
function fixHref(f: Finding): string {
  return `/dashboard/sources?doc=${f.documentId}`
}

export function Findings({
  csrf,
  findings,
  lens,
  onChanged,
}: {
  csrf: string
  findings: Finding[]
  lens: string | null
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  // Optimistic hides for in-flight dismisses. `findings` is now owned by the
  // parent (BrainMap), which refetches after `onChanged()` fires — so once a
  // fresh list lands here, drop any stale hides instead of tracking removal
  // locally.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    setHiddenIds(new Set())
  }, [findings])

  async function dismiss(id: string) {
    setBusyId(id)
    setHiddenIds((prev) => new Set(prev).add(id))
    try {
      await fetch(`/api/graph/findings/${id}/dismiss`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      })
    } catch {
      setHiddenIds((prev) => {
        const next = new Set(prev)
        next.delete(id) // roll back the optimistic hide on network failure
        return next
      })
    } finally {
      setBusyId(null)
      onChanged()
    }
  }

  const kindFilter = lens ? LENS_KINDS[lens] : null
  const visible = findings.filter(
    (f) => !hiddenIds.has(f.id) && (!kindFilter || kindFilter.includes(f.kind)),
  )

  const groups = new Map<string, Finding[]>()
  for (const f of visible) {
    const list = groups.get(f.kind) ?? []
    list.push(f)
    groups.set(f.kind, list)
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-paper-raised">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-lg text-ink">Findings</h2>
        <p className="mt-1 text-body-sm text-ink-soft">
          {visible.length === 0 ? 'Nothing needs attention.' : `${visible.length} to review`}
        </p>
      </div>
      <div className="divide-y divide-line">
        {[...groups.entries()].map(([kind, items]) => {
          const meta = kindMeta(kind)
          return (
            <section key={kind} className="px-4 py-3">
              <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
                {meta.label} · {items.length}
              </h3>
              <ul className="mt-2 space-y-2">
                {items.map((f) => (
                  <li key={f.id} className={`rounded-md border px-3 py-2 text-body-sm ${meta.badge}`}>
                    <div className="truncate font-medium text-ink">{f.filename}</div>
                    <p className="mt-1 text-ink-soft">{meta.explain(f)}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Link
                        href={fixHref(f)}
                        className="text-body-sm text-brain-text underline underline-offset-2"
                      >
                        Fix
                      </Link>
                      <button
                        onClick={() => dismiss(f.id)}
                        disabled={busyId === f.id}
                        className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {visible.length === 0 && (
          <p className="px-4 py-6 text-body-sm text-ink-soft">
            No open findings for this view. Rebuild the map after uploading or re-tagging
            documents to refresh them.
          </p>
        )}
      </div>
    </aside>
  )
}
