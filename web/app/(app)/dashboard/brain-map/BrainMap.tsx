'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { forceX, forceY, forceCollide } from 'd3-force'
import { Findings } from './Findings'

// Canvas rendering only makes sense in the browser — force-graph touches
// `window`/`document` at import time, so it must never run during SSR/build.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type Job = { id: string; status: string; error: string | null; computedAt: string | null }
type DocNode = {
  id: string
  filename: string
  department: string
  exposureScore: number
  isOrphan: boolean
  degree: number
}
type DocEdge = { source: string; target: string; weight: number }
export type Finding = {
  id: string
  kind: string
  documentId: string
  severity: number
  detail: Record<string, unknown>
  filename: string
}

type Lens = 'anomaly' | 'exposure' | 'orphan' | 'deadstale'
const LENS_OPTIONS: { id: Lens; label: string }[] = [
  { id: 'anomaly', label: 'Anomaly' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'orphan', label: 'Orphan' },
  { id: 'deadstale', label: 'Dead/Stale' },
]

// Department palette — six hues chosen to sit on the warm-paper ground
// (#F3EEE3) with roughly even chroma so no one department shouts. Sales keeps
// the brand violet; "Everyone" (shared-with-all) is a deliberately quiet warm
// grey so over-shared docs read as un-owned rather than as their own category.
const DEPT_COLORS: Record<string, string> = {
  Engineering: '#3b6fe0',
  Finance: '#12a074',
  Legal: '#dd8a2b',
  People: '#d6567f',
  Sales: '#684bff',
  Everyone: '#9c948a',
}
const DEPT_FALLBACK = '#9c948a'
const deptColor = (d: string) => DEPT_COLORS[d] ?? DEPT_FALLBACK

// Governance-lens colors (semantic, separate from department hues).
const ANOMALY_HIT = '#d8315b'
const ORPHAN_HIT = '#e07b39'
const MUTED = '#b8b0a2'
const DEADSTALE_FADED = '#c9c0ab'
const INK = '#1c1b18'

function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0))
  const cool = [90, 128, 160]
  const hot = [224, 123, 57]
  const [r, g, b] = cool.map((v, i) => Math.round(v + (hot[i] - v) * c))
  return `rgb(${r}, ${g}, ${b})`
}

const shortName = (f: string) => f.replace(/\.[a-z0-9]+$/i, '')

export function BrainMap({
  csrf,
  groups,
}: {
  csrf: string
  groups: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [asGroup, setAsGroup] = useState('') // '' = owner · everything
  const [nodes, setNodes] = useState<DocNode[]>([])
  const [edges, setEdges] = useState<DocEdge[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [findings, setFindings] = useState<Finding[]>([])
  const [lens, setLens] = useState<Lens | null>(null)
  const [query, setQuery] = useState('')
  const [hoverId, setHoverId] = useState<string | null>(null)
  // First click selects a node (persistent focus + tooltip); clicking the
  // selected node again opens it. `activeDept` isolates one legend category.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeDept, setActiveDept] = useState<string | null>(null)

  const fgRef = useRef<any>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<any[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const mounted = useRef(true)
  useEffect(() => () => void (mounted.current = false), [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const loadGraph = useCallback(async (): Promise<Job | null> => {
    const qs = asGroup ? `?as_group=${encodeURIComponent(asGroup)}` : ''
    const [g, jr] = await Promise.all([
      fetch(`/api/graph/documents${qs}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/graph${qs}`, { cache: 'no-store' }).then((r) => r.json()),
    ])
    setNodes((g.nodes ?? []) as DocNode[])
    setEdges((g.edges ?? []) as DocEdge[])
    setJob((jr.job ?? null) as Job | null)
    return (jr.job ?? null) as Job | null
  }, [asGroup])

  const loadFindings = useCallback(async () => {
    const qs = asGroup ? `?as_group=${encodeURIComponent(asGroup)}` : ''
    const r = await fetch(`/api/graph/findings${qs}`, { cache: 'no-store' })
    if (r.ok) setFindings(((await r.json()).findings ?? []) as Finding[])
  }, [asGroup])

  useEffect(() => {
    void loadGraph()
  }, [loadGraph])
  useEffect(() => {
    void loadFindings()
  }, [loadFindings])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadGraph(), loadFindings()])
  }, [loadGraph, loadFindings])

  const rebuild = useCallback(async () => {
    setRebuilding(true)
    await fetch('/api/graph/rebuild', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({}),
    })
    const poll = async () => {
      const job = await loadGraph()
      if (!mounted.current) return
      if (job?.status === 'running') setTimeout(poll, 1500)
      else {
        setRebuilding(false)
        void loadFindings()
      }
    }
    await poll()
  }, [csrf, loadGraph, loadFindings])

  const findingsByDoc = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const f of findings) {
      const s = m.get(f.documentId) ?? new Set<string>()
      s.add(f.kind)
      m.set(f.documentId, s)
    }
    return m
  }, [findings])

  const groupNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.id, g.name)
    return m
  }, [groups])

  // Adjacency for hover-focus highlighting.
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set())
      if (!m.has(e.target)) m.set(e.target, new Set())
      m.get(e.source)!.add(e.target)
      m.get(e.target)!.add(e.source)
    }
    return m
  }, [edges])

  // Departments present, for the legend.
  const legend = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of nodes) counts.set(n.department, (counts.get(n.department) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [nodes])

  // The set of node ids currently "in focus" (everything else is dimmed).
  // Precedence: a hovered/selected node lights itself + its neighbors; else a
  // search narrows to filename matches; else an active legend category isolates
  // that department. null = no focus (everything full-strength).
  const q = query.trim().toLowerCase()
  const focus = useMemo(() => {
    const focusNode = hoverId ?? selectedId
    if (focusNode) {
      const s = new Set<string>([focusNode])
      for (const n of adjacency.get(focusNode) ?? []) s.add(n)
      return s
    }
    if (q) {
      const s = new Set<string>()
      for (const n of nodes) if (n.filename.toLowerCase().includes(q)) s.add(n.id)
      return s
    }
    if (activeDept) {
      const s = new Set<string>()
      for (const n of nodes) if (n.department === activeDept) s.add(n.id)
      return s
    }
    return null
  }, [hoverId, selectedId, q, activeDept, adjacency, nodes])

  // The node whose tooltip is shown: hovered takes precedence, else selected.
  const tipId = hoverId ?? selectedId
  const tip = tipId ? (nodes.find((n) => n.id === tipId) ?? null) : null

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n, name: n.filename })),
      links: edges.map((e) => ({ source: e.source, target: e.target, value: e.weight })),
    }),
    [nodes, edges],
  )

  // force-graph mutates these node objects in place with live x/y; keep a handle
  // so the tooltip can track the node's screen position across pan/zoom.
  useEffect(() => {
    nodesRef.current = graphData.nodes
  }, [graphData])

  // Keep the tooltip glued to its node. Runs a rAF loop while a node is
  // hovered/selected, projecting graph coords → screen coords every frame so it
  // follows the node during pan/zoom (and after the sim settles it just holds).
  useEffect(() => {
    const el = tipRef.current
    if (!tipId || !el) {
      if (el) el.style.opacity = '0'
      return
    }
    let raf = 0
    const tick = () => {
      const fg = fgRef.current
      const node = nodesRef.current.find((n) => String(n.id) === tipId)
      if (fg?.graph2ScreenCoords && node && typeof node.x === 'number') {
        const { x, y } = fg.graph2ScreenCoords(node.x, node.y)
        el.style.transform = `translate(${x + 12}px, ${y - 14}px)`
        el.style.opacity = '1'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (el) el.style.opacity = '0'
    }
  }, [tipId])

  const colorFor = useCallback(
    (n: DocNode) => {
      if (lens) {
        const kinds = findingsByDoc.get(n.id) ?? new Set<string>()
        switch (lens) {
          case 'anomaly':
            return kinds.has('permission_anomaly') ? ANOMALY_HIT : MUTED
          case 'exposure':
            return heatColor(n.exposureScore)
          case 'orphan':
            return n.isOrphan ? ORPHAN_HIT : MUTED
          case 'deadstale':
            return kinds.has('dead') || kinds.has('stale') ? DEADSTALE_FADED : MUTED
        }
      }
      return deptColor(n.department)
    },
    [lens, findingsByDoc],
  )

  // Tune the force simulation once nodes are present: strong-ish repulsion so
  // clusters breathe, moderate link distance so similarity edges pull
  // departments together.
  const radius = (degree: number) => 3.4 + Math.sqrt(degree) * 1.7

  // The force-graph is lazy-loaded (dynamic import, ssr:false), so on first
  // render its d3 simulation isn't ready yet and `d3Force(...)` returns
  // undefined — a plain effect would silently no-op. Poll until the sim exists,
  // then tune it: firm repulsion + collision spreads a cluster so labels are
  // readable, while x/y gravity keeps low-degree/disconnected docs gathered so
  // zoom-to-fit frames a filled graph rather than a tiny blob. Similarity edges
  // do the department-gathering.
  useEffect(() => {
    if (nodes.length === 0) return
    let tries = 0
    const iv = setInterval(() => {
      const fg = fgRef.current
      const charge = fg?.d3Force?.('charge')
      if (charge) {
        charge.strength(-150)
        fg.d3Force('link')?.distance(50).strength(0.3)
        fg.d3Force('x', forceX(0).strength(0.22))
        fg.d3Force('y', forceY(0).strength(0.22))
        fg.d3Force('collide', forceCollide((n: any) => radius(n.degree ?? 0) + 6))
        fg.d3ReheatSimulation?.()
        clearInterval(iv)
      } else if (++tries > 60) {
        clearInterval(iv)
      }
    }, 50)
    return () => clearInterval(iv)
  }, [nodes.length, edges.length])

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
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-48 rounded-md border border-line-control bg-paper-raised px-2.5 py-1.5 text-ink placeholder:text-ink-soft focus:border-brain focus:outline-none"
          />
          <div className="flex items-center gap-1">
            {LENS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-on={lens === opt.id}
                onClick={() => setLens((p) => (p === opt.id ? null : opt.id))}
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

        <div ref={containerRef} className="relative min-h-0 flex-1 bg-paper">
          {nodes.length === 0 ? (
            <p className="px-4 py-6 text-body-sm text-ink-soft">
              No documents yet. Upload documents in Sources, then rebuild the map.
            </p>
          ) : (
            size.width > 0 &&
            size.height > 0 && (
              <ForceGraph2D
                ref={fgRef}
                width={size.width}
                height={size.height}
                graphData={graphData}
                nodeRelSize={6}
                warmupTicks={80}
                cooldownTicks={220}
                onEngineStop={() => fgRef.current?.zoomToFit(500, 70)}
                onNodeHover={(n: any) => setHoverId(n ? String(n.id) : null)}
                onNodeClick={(n: any) => {
                  const id = String(n.id)
                  // First click selects; clicking the already-selected node opens it.
                  if (selectedId === id) {
                    router.push(`/dashboard/sources?doc=${encodeURIComponent(id)}`)
                  } else {
                    setSelectedId(id)
                  }
                }}
                onBackgroundClick={() => setSelectedId(null)}
                linkColor={(link: any) => {
                  const s = typeof link.source === 'object' ? link.source.id : link.source
                  const t = typeof link.target === 'object' ? link.target.id : link.target
                  const lit = focus ? focus.has(s) && focus.has(t) : false
                  if (focus && !lit) return 'rgba(120,110,95,0.05)'
                  return lit ? 'rgba(104,75,255,0.35)' : 'rgba(120,110,95,0.16)'
                }}
                linkWidth={(link: any) => {
                  const s = typeof link.source === 'object' ? link.source.id : link.source
                  const t = typeof link.target === 'object' ? link.target.id : link.target
                  return focus && focus.has(s) && focus.has(t) ? 1.5 : 0.6
                }}
                nodeCanvasObjectMode={() => 'replace'}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
                  const dimmed = focus ? !focus.has(String(node.id)) : false
                  const r = radius(node.degree ?? 0)
                  const color = colorFor(node as DocNode)
                  ctx.globalAlpha = dimmed ? 0.18 : 1
                  // soft halo when focused
                  if (focus && !dimmed) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, r + 3.5, 0, 2 * Math.PI)
                    ctx.fillStyle = color
                    ctx.globalAlpha = dimmed ? 0.18 : 0.18
                    ctx.fill()
                    ctx.globalAlpha = 1
                  }
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
                  ctx.fillStyle = color
                  ctx.fill()
                  ctx.lineWidth = 1 / scale
                  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
                  ctx.stroke()
                  // selection ring
                  if (String(node.id) === selectedId) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI)
                    ctx.lineWidth = 1.6 / scale
                    ctx.strokeStyle = '#684bff'
                    ctx.stroke()
                  }

                  const focused = focus ? focus.has(String(node.id)) : false
                  const showLabel = focused || scale > 2.4 || (node.degree ?? 0) >= 9
                  if (showLabel && !dimmed) {
                    const label = shortName(String(node.name ?? ''))
                    const fontSize = Math.max(11 / scale, 2.2)
                    ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'top'
                    const y = node.y + r + 2
                    // parchment halo so labels stay legible over edges
                    const w = ctx.measureText(label).width
                    ctx.globalAlpha = 0.72
                    ctx.fillStyle = '#F3EEE3'
                    ctx.fillRect(node.x - w / 2 - 2, y - 1, w + 4, fontSize + 2)
                    ctx.globalAlpha = 1
                    ctx.fillStyle = INK
                    ctx.fillText(label, node.x, y)
                  }
                  ctx.globalAlpha = 1
                }}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, radius(node.degree ?? 0) + 2, 0, 2 * Math.PI)
                  ctx.fillStyle = color
                  ctx.fill()
                }}
                backgroundColor="transparent"
              />
            )
          )}

          {/* Node tooltip — glued to the hovered/selected node (positioned imperatively) */}
          <div
            ref={tipRef}
            style={{ opacity: 0 }}
            className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-[0.72rem] text-paper shadow-artifact"
          >
            {tip && (
              <>
                <span className="font-medium">{shortName(tip.filename)}</span>
                <span className="opacity-60">
                  {' · '}
                  {tip.degree} connection{tip.degree === 1 ? '' : 's'}
                  {' · '}
                  {tip.department}
                </span>
              </>
            )}
          </div>

          {/* Interactive legend — click a category to isolate it */}
          {legend.length > 0 && (
            <div className="absolute bottom-3 left-3 flex min-w-[10.5rem] flex-col gap-0.5 rounded-lg border border-line bg-paper-raised/80 p-1.5 backdrop-blur-sm">
              {legend.map(([dept, count]) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setActiveDept((p) => (p === dept ? null : dept))}
                  data-on={activeDept === dept}
                  style={{ opacity: activeDept && activeDept !== dept ? 0.4 : 1 }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-0.5 text-left text-[0.7rem] text-ink-soft hover:bg-paper-sunk data-[on=true]:bg-paper-sunk"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: deptColor(dept) }}
                  />
                  <span className="text-ink">{dept}</span>
                  <span className="ml-auto tabular-nums">{count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Active lens / category hint */}
          {(lens || activeDept) && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-line bg-paper-raised/80 px-3 py-1.5 text-[0.7rem] text-ink-soft backdrop-blur-sm">
              {lens && (
                <>
                  Coloring by{' '}
                  <span className="text-brain-text">
                    {lens === 'deadstale' ? 'dead / stale' : lens}
                  </span>{' '}
                  lens
                </>
              )}
              {lens && activeDept && ' · '}
              {activeDept && (
                <>
                  Showing <span className="text-brain-text">{activeDept}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Findings
        csrf={csrf}
        findings={findings}
        lens={lens}
        onChanged={refreshAll}
        groupNames={groupNames}
      />
    </div>
  )
}
