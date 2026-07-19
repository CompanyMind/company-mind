'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Findings } from './Findings'

// Canvas rendering only makes sense in the browser — force-graph touches
// `window`/`document` at import time, so it must never run during SSR/build.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type Topic = { id: string; label: string; x: number; y: number; docCount: number }
type Job = { id: string; status: string; error: string | null; computedAt: string | null }
type DocNode = {
  id: string
  filename: string
  exposureScore: number
  isOrphan: boolean
  lastRetrievedAt: string | null
}
export type Finding = {
  id: string
  kind: string
  documentId: string
  severity: number
  detail: Record<string, unknown>
  filename: string
}

// Which lens is active. Maps 1:1 to the four toolbar toggles; 'deadstale'
// covers both the `dead` and `stale` finding kinds (spec treats them as one
// governance signal).
type Lens = 'anomaly' | 'exposure' | 'orphan' | 'deadstale'

const LENS_OPTIONS: { id: Lens; label: string }[] = [
  { id: 'anomaly', label: 'Anomaly' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'orphan', label: 'Orphan' },
  { id: 'deadstale', label: 'Dead/Stale' },
]

// Lens colors are deliberately semantic and separate from the brand violet
// (`--brain` / #684bff, kept for topic nodes and the no-lens default) — see
// styles/tokens.css's contrast law for why these particular tokens:
//   - ANOMALY_HIT reuses `--sovereign` (#d8315b), the same red Findings.tsx
//     uses for the permission_anomaly badge.
//   - ORPHAN_HIT reuses `--query` (#e07b39), the same amber Findings.tsx uses
//     for the over_exposure badge, per the "amber highlight" spec for orphans.
//   - MUTED (`--line-control`, #857960) is the neutral "this lens doesn't
//     flag this doc" color — a UI-only tone, never brand and never a lens hit.
//   - DEADSTALE_FADED is a desaturated parchment tone: dead/stale docs read as
//     faded rather than alarmed, matching the dashed/faded badge treatment.
const ANOMALY_HIT = '#d8315b'
const ORPHAN_HIT = '#e07b39'
const MUTED = '#857960'
const DEADSTALE_FADED = '#c9c0ab'
const BRAND = '#684bff'

// Exposure heat: 0 -> a cool slate-blue (deliberately outside the warm-paper
// palette, so "cool" reads as cool) interpolated to 1 -> `--query` hot amber.
function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0))
  const cool = [122, 146, 168]
  const hot = [224, 123, 57] // --query
  const [r, g, b] = cool.map((c, i) => Math.round(c + (hot[i] - c) * clamped))
  return `rgb(${r}, ${g}, ${b})`
}

export function BrainMap({
  csrf,
  groups,
}: {
  csrf: string
  groups: { id: string; name: string }[]
}) {
  const [asGroup, setAsGroup] = useState('') // '' = owner · everything
  const [topics, setTopics] = useState<Topic[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [findings, setFindings] = useState<Finding[]>([])
  const [lens, setLens] = useState<Lens | null>(null)

  // Drill-down state: null = topic overview; set = viewing one topic's
  // documents. Doc nodes have no stored layout (only topics are PCA-placed),
  // so they're force-simulated instead of pinned.
  const [topic, setTopic] = useState<{ id: string; label: string } | null>(null)
  const [docNodes, setDocNodes] = useState<DocNode[]>([])
  const [docsLoading, setDocsLoading] = useState(false)

  // Measures the canvas's own flex-sized wrapper. force-graph defaults width/
  // height to window.innerWidth/innerHeight when unset, which would blow the
  // canvas out past the sidebar and toolbar — so we always pass explicit
  // pixel dimensions taken from a ResizeObserver on the wrapper.
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const load = useCallback(async (): Promise<{ topics: Topic[]; job: Job | null }> => {
    const qs = asGroup ? `?as_group=${encodeURIComponent(asGroup)}` : ''
    const r = await fetch(`/api/graph${qs}`, { cache: 'no-store' })
    const d = await r.json()
    const next = { topics: (d.topics ?? []) as Topic[], job: (d.job ?? null) as Job | null }
    setTopics(next.topics)
    setJob(next.job)
    return next
  }, [asGroup])

  const loadFindings = useCallback(async () => {
    const qs = asGroup ? `?as_group=${encodeURIComponent(asGroup)}` : ''
    const r = await fetch(`/api/graph/findings${qs}`, { cache: 'no-store' })
    if (r.ok) setFindings(((await r.json()).findings ?? []) as Finding[])
  }, [asGroup])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadFindings()
  }, [loadFindings])

  // Refetches both the topic map and the findings list. Passed to <Findings>
  // as `onChanged` (fired after a dismiss) and also called once a rebuild
  // finishes, since a rebuild recomputes findings too.
  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadFindings()])
  }, [load, loadFindings])

  // Guards against setState after unmount while a rebuild poll or a topic
  // fetch is in flight.
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const rebuild = useCallback(async () => {
    setRebuilding(true)
    await fetch('/api/graph/rebuild', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({}),
    })
    // Poll for completion using the just-fetched result, not the `job` state
    // variable — a setInterval closure over `job` would forever see the value
    // from the render that started the poll and never notice it finished.
    const poll = async () => {
      const d = await load()
      if (!mounted.current) return
      if (d.job?.status === 'running') {
        setTimeout(poll, 1500)
      } else {
        setRebuilding(false)
        void loadFindings()
      }
    }
    await poll()
  }, [csrf, load, loadFindings])

  // Fetch a topic's documents whenever the drill-down target (or the "view
  // as" group) changes. Clearing `topic` clears the doc list back to empty
  // so the overview's emptiness check doesn't see stale data.
  useEffect(() => {
    if (!topic) {
      setDocNodes([])
      return
    }
    let cancelled = false
    setDocsLoading(true)
    const qs = asGroup ? `?as_group=${encodeURIComponent(asGroup)}` : ''
    fetch(`/api/graph/topic/${topic.id}${qs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDocNodes((d.nodes ?? []) as DocNode[])
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [topic, asGroup])

  const handleNodeClick = useCallback(
    (node: { id?: string | number; name?: string }) => {
      if (topic || node.id == null) return // already drilled in — use "All topics" to go back
      setTopic({ id: String(node.id), label: String(node.name ?? node.id) })
    },
    [topic],
  )

  // documentId -> the set of finding kinds open against it. Built once here
  // (not duplicated in Findings) so the map's Anomaly/Dead-Stale lenses and
  // the sidebar list read from the same fetch.
  const findingsByDoc = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const f of findings) {
      const set = map.get(f.documentId) ?? new Set<string>()
      set.add(f.kind)
      map.set(f.documentId, set)
    }
    return map
  }, [findings])

  const graphData = useMemo(() => {
    if (topic) {
      return {
        nodes: docNodes.map((d) => ({
          id: d.id,
          name: d.filename,
          val: 3,
          exposureScore: d.exposureScore,
          isOrphan: d.isOrphan,
        })),
        links: [] as never[],
      }
    }
    return {
      nodes: topics.map((t) => ({
        id: t.id,
        name: t.label,
        val: Math.max(1, t.docCount),
        // Stored coordinates are PCA-normalized to ~[-1, 1]; scale to a
        // comfortable canvas span and pin (fx/fy) so the layout is stable
        // across rebuilds instead of re-simulating on every load.
        fx: t.x * 400,
        fy: t.y * 400,
      })),
      links: [] as never[],
    }
  }, [topic, docNodes, topics])

  // Lens encodings are per-document (spec §4) — topic-overview nodes always
  // stay brand violet regardless of the active lens.
  const nodeColor = useCallback(
    (node: { id?: string | number; exposureScore?: number; isOrphan?: boolean }) => {
      if (!topic || !lens) return BRAND
      const kinds = findingsByDoc.get(String(node.id)) ?? new Set<string>()
      switch (lens) {
        case 'anomaly':
          return kinds.has('permission_anomaly') ? ANOMALY_HIT : MUTED
        case 'exposure':
          return heatColor(typeof node.exposureScore === 'number' ? node.exposureScore : 0)
        case 'orphan':
          return node.isOrphan ? ORPHAN_HIT : MUTED
        case 'deadstale':
          return kinds.has('dead') || kinds.has('stale') ? DEADSTALE_FADED : MUTED
        default:
          return BRAND
      }
    },
    [topic, lens, findingsByDoc],
  )

  const isEmpty = topic ? !docsLoading && docNodes.length === 0 : topics.length === 0

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2 text-body-sm">
          <button
            onClick={rebuild}
            disabled={rebuilding}
            className="rounded-md border border-line px-3 py-1.5 text-ink-soft hover:bg-paper-sunk disabled:opacity-50"
          >
            {rebuilding ? 'Rebuilding…' : 'Rebuild map'}
          </button>
          <span className="text-ink-soft">
            {job?.computedAt ? `as of ${new Date(job.computedAt).toLocaleString()}` : 'never built'}
          </span>
          {topic && (
            <button
              onClick={() => setTopic(null)}
              className="rounded-md border border-line px-2.5 py-1 text-ink-soft hover:bg-paper-sunk"
            >
              ← All topics
            </button>
          )}
          <div className="flex items-center gap-1">
            {LENS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-on={lens === opt.id}
                onClick={() => setLens((prev) => (prev === opt.id ? null : opt.id))}
                className="rounded-md border border-line px-2.5 py-1 text-ink-soft data-[on=true]:border-brain data-[on=true]:bg-[color-mix(in_srgb,var(--brain)_12%,transparent)] data-[on=true]:text-brain-text"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-ink-soft">
            View as
            <select
              value={asGroup}
              onChange={(e) => setAsGroup(e.target.value)}
              className="rounded-md border border-line-control bg-paper-raised px-2 py-1.5 text-ink"
            >
              <option value="">Owner · everything</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div ref={containerRef} className="min-h-0 flex-1 bg-paper">
          {isEmpty ? (
            <p className="px-4 py-6 text-body-sm text-ink-soft">
              {topic
                ? 'No documents in this topic.'
                : 'No topics yet. Upload documents in Sources, then rebuild the map.'}
            </p>
          ) : (
            size.width > 0 &&
            size.height > 0 && (
              <ForceGraph2D
                width={size.width}
                height={size.height}
                graphData={graphData}
                nodeLabel="name"
                nodeRelSize={6}
                nodeColor={nodeColor}
                linkColor={() => 'var(--line)'}
                backgroundColor="transparent"
                cooldownTicks={topic ? undefined : 0}
                onNodeClick={handleNodeClick}
              />
            )
          )}
        </div>
      </div>
      <Findings csrf={csrf} findings={findings} lens={lens} onChanged={refreshAll} />
    </div>
  )
}
