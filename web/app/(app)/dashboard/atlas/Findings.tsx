'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Finding } from '@/lib/graph'

// Maps each map lens toggle to the finding kind(s) it corresponds to in the
// sidebar. 'deadstale' is the one lens that covers two kinds — the map's
// Dead/Stale toggle treats them as a single governance signal.
/**
 * How many findings of one kind the rail shows before folding.
 *
 * Production carried 320 open findings, 94 of them over-exposure — because
 * `create_document` tags every upload to Everyone, so "over-exposed" is the
 * state a document is BORN in. That count is true and worth knowing; printing
 * it as 94 identical cards is what made the rail unreadable. The header still
 * shows the real total, so nothing is hidden — only folded, worst first.
 */
const COLLAPSED_PER_KIND = 5

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
// Renders a list of group ids as a human sentence fragment, e.g. "Finance"
// or "Finance, Legal". An id with no match in `groupNames` (deleted group,
// or a lookup miss) falls back to "a group" rather than printing the raw
// UUID — the whole point of this map is that no UUID ever reaches the UI.
function namesFor(ids: string[] | undefined, groupNames: Map<string, string>): string {
  const list = (ids ?? []).map((id) => groupNames.get(id) ?? 'a group')
  return list.length > 0 ? list.join(', ') : 'no one'
}

const KIND_META: Record<
  string,
  { label: string; badge: string; explain: (f: Finding, groupNames: Map<string, string>) => string }
> = {
  permission_anomaly: {
    label: 'Permission anomalies',
    badge: 'border-sovereign bg-[color-mix(in_srgb,var(--sovereign)_8%,transparent)] text-sovereign-text',
    explain: (f, groupNames) => {
      const d = f.detail as { consensus?: string[]; doc_groups?: string[]; direction?: string }
      const mine = namesFor(d.doc_groups, groupNames)
      const consensus = namesFor(d.consensus, groupNames)
      return d.direction === 'over_shared'
        ? `Shared with ${mine} — broader than ${consensus}, which the rest of this topic shares.`
        : `Restricted to ${mine} — narrower than the rest of this topic (shared with ${consensus}).`
    },
  },
  over_exposure: {
    label: 'Over-exposed',
    badge: 'border-query bg-[color-mix(in_srgb,var(--query)_8%,transparent)] text-query-text',
    // Ninety-four cards all reading "Visible to nearly everyone in the
    // workspace" is one fact printed ninety-four times: nothing to compare, no
    // reason to open one card rather than another. The detail the engine
    // already sends says which kind of exposure this is — the default Everyone
    // tag a document was uploaded with, or a hand-tagged spread across most of
    // the firm's groups — and those are different problems with different fixes.
    explain: (f) => {
      const d = f.detail as { everyone?: boolean; group_count?: number }
      if (d.everyone) return 'Tagged Everyone, so the whole firm can retrieve it.'
      return typeof d.group_count === 'number'
        ? `Shared with ${d.group_count} access groups.`
        : 'Shared with most of the workspace.'
    },
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
  groupNames,
}: {
  csrf: string
  findings: Finding[]
  lens: string | null
  onChanged: () => void
  groupNames: Map<string, string>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set())
  // Optimistic hides for in-flight dismisses. `findings` is now owned by the
  // parent (Atlas), which refetches after `onChanged()` fires — so once a
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
  // Worst first, within each kind. The engine already scores severity; the rail
  // was rendering in whatever order the query returned, so the one document
  // that actually mattered could sit ninetieth.
  for (const list of groups.values()) list.sort((a, b) => b.severity - a.severity)

  return (
    /* The map is the page; the rail annotates it. At 320px on a 1200px screen
       the rail took a third of the width and left the graph 608px to draw 152
       nodes in. It now scales with the viewport instead of being fixed wide. */
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-line bg-paper-raised xl:w-80">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-lg text-ink">Findings</h2>
        <p className="mt-1 text-body-sm text-ink-soft">
          {visible.length === 0 ? 'Nothing needs attention.' : `${visible.length} to review`}
        </p>
      </div>
      <div className="divide-y divide-line">
        {[...groups.entries()].map(([kind, items]) => {
          const meta = kindMeta(kind)
          const expanded = expandedKinds.has(kind)
          const shown = expanded ? items : items.slice(0, COLLAPSED_PER_KIND)
          return (
            <section key={kind} className="px-4 py-3">
              <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
                {meta.label} · {items.length}
              </h3>
              <ul className="mt-2 space-y-2">
                {shown.map((f) => (
                  <li key={f.id} className={`rounded-md border px-3 py-2 text-body-sm ${meta.badge}`}>
                    <div className="truncate font-medium text-ink">{f.filename}</div>
                    <p className="mt-1 text-ink-soft">{meta.explain(f, groupNames)}</p>
                    {/* Not two underlined links of equal weight. Reviewing the
                        document is the action this rail exists to produce;
                        Dismiss retires a governance finding permanently and
                        should never be the easier thing to hit by accident. */}
                    <div className="mt-2 flex items-center gap-3">
                      <Link
                        href={fixHref(f)}
                        className="rounded-md border border-line-control px-2 py-1 text-body-sm text-ink hover:border-brain hover:text-brain-text"
                      >
                        Review
                      </Link>
                      <button
                        onClick={() => dismiss(f.id)}
                        disabled={busyId === f.id}
                        className="text-body-sm text-ink-soft hover:text-ink disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {/* A rail that silently showed the first slice would read as "this
                  is all of it". Say what is held back, and offer it. */}
              {items.length > COLLAPSED_PER_KIND && (
                <button
                  onClick={() =>
                    setExpandedKinds((prev) => {
                      const next = new Set(prev)
                      if (next.has(kind)) next.delete(kind)
                      else next.add(kind)
                      return next
                    })
                  }
                  className="mt-2 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  {expanded
                    ? `Show the worst ${COLLAPSED_PER_KIND}`
                    : `Showing ${COLLAPSED_PER_KIND} of ${items.length} — show all`}
                </button>
              )}
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
