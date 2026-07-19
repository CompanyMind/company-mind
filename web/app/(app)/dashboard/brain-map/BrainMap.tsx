'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Findings } from './Findings'

// Canvas rendering only makes sense in the browser — force-graph touches
// `window`/`document` at import time, so it must never run during SSR/build.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type Topic = { id: string; label: string; x: number; y: number; docCount: number }
type Job = { id: string; status: string; error: string | null; computedAt: string | null }

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

  useEffect(() => {
    void load()
  }, [load])

  // Guards against setState after unmount while a rebuild poll is in flight.
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
      }
    }
    await poll()
  }, [csrf, load])

  const graphData = useMemo(
    () => ({
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
    }),
    [topics],
  )

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
          {topics.length === 0 ? (
            <p className="px-4 py-6 text-body-sm text-ink-soft">
              No topics yet. Upload documents in Sources, then rebuild the map.
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
                nodeColor={() => '#684bff'}
                linkColor={() => 'var(--line)'}
                backgroundColor="transparent"
                cooldownTicks={0}
              />
            )
          )}
        </div>
      </div>
      <Findings csrf={csrf} asGroup={asGroup} onChanged={load} />
    </div>
  )
}
