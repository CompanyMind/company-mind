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

// Department palette. Hues sit on the warm-paper ground (#F3EEE3) at roughly
// even chroma so no one department shouts. A department is whatever the first
// non-default access group is called (engine `_department`), so the set of names
// is open — a workspace can create any group it likes. Hard-coding a name->hex
// map therefore rots the moment someone adds a group: every unlisted department
// collapsed into the same grey as "Everyone", which read as "un-owned" and made
// most of the map colorless. So only the established departments are pinned, and
// anything else derives a stable hue from its own name.
//
// "Everyone" (shared-with-all) stays a deliberately quiet warm grey so
// over-shared docs read as un-owned rather than as their own category.
const EVERYONE_GREY = '#9c948a'
const DEPT_ANCHORS: Record<string, string> = {
  Engineering: '#3b6fe0',
  Finance: '#12a074',
  Legal: '#dd8a2b',
  Sales: '#684bff', // the brand violet
  Everyone: EVERYONE_GREY,
}

// Hues for everything not pinned above, spaced around the wheel and kept clear
// of the anchor hues (~33 orange, ~163 green, ~220 blue, ~253 violet) so a
// derived department is never mistaken for an anchored one. Saturation and
// lightness are fixed to match the anchors' weight on paper.
const DERIVED_HUES = [185, 330, 352, 300, 92, 55, 205, 270, 138, 15, 240, 115]

// Seeded per name (FNV-1a) rather than per position in the dataset, so a
// department keeps its color as documents are added, removed, or re-ranked.
function hueSeed(name: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % DERIVED_HUES.length
}

const derivedColor = (i: number) => `hsl(${DERIVED_HUES[i]} 58% 47%)`

// The seed alone collides (8 names into 12 hues is a birthday problem — "IT"
// and "Support" landed on the same hue), and two same-colored departments are
// worse than a dull one. So hues are assigned across the departments actually
// present: each starts at its seed and probes forward to the first free hue.
// Departments are walked alphabetically, NOT by document count, so a color does
// not jump when the legend re-ranks. Past DERIVED_HUES.length departments hues
// necessarily repeat; the anchors and "Everyone" are never consumed.
function buildDeptColors(departments: string[]): (d: string) => string {
  const taken = new Set<number>()
  const assigned = new Map<string, string>()
  for (const d of [...departments].sort()) {
    if (DEPT_ANCHORS[d]) continue
    let i = hueSeed(d)
    for (let n = 0; n < DERIVED_HUES.length && taken.has(i); n++) {
      i = (i + 1) % DERIVED_HUES.length
    }
    taken.add(i)
    assigned.set(d, derivedColor(i))
  }
  return (d) => DEPT_ANCHORS[d] ?? assigned.get(d) ?? derivedColor(hueSeed(d))
}

// Governance-lens colors (semantic, separate from department hues).
const ANOMALY_HIT = '#d8315b'
const ORPHAN_HIT = '#e07b39'
const MUTED = '#b8b0a2'
const DEADSTALE_FADED = '#c9c0ab'
const INK = '#1c1b18'

// Node sizing/labeling is relative to the CURRENT dataset, not a fixed pixel
// size or connection count tuned once and left to rot. Whatever the actual
// degree numbers turn out to be, the single most-connected document always
// renders at MAX_RADIUS and a disconnected one at MIN_RADIUS; the whole range
// then shrinks as the document count grows past REFERENCE_NODE_COUNT (the
// size this range was eyeballed at) so a bigger library doesn't just render
// as bigger overlapping dots. Hub labels follow the same idea — see
// `degreeStats` below — so neither needs re-tuning as documents are added.
const MIN_RADIUS = 2.6
const MAX_RADIUS = 11
const REFERENCE_NODE_COUNT = 36

function heatColor(t: number): string {
  const c = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0))
  const cool = [90, 128, 160]
  const hot = [224, 123, 57]
  const [r, g, b] = cool.map((v, i) => Math.round(v + (hot[i] - v) * c))
  return `rgb(${r}, ${g}, ${b})`
}

const shortName = (f: string) => f.replace(/\.[a-z0-9]+$/i, '')

export function Atlas({
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
  // Hovering a node focuses it (highlight + tooltip); clicking opens its source.
  const [hoverId, setHoverId] = useState<string | null>(null)
  // `activeDept` isolates one legend category.
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

  // Degree distribution of the CURRENT graph, so sizing/labeling can be
  // relative instead of hand-tuned constants that go stale as documents are
  // added or removed. hubThreshold picks a degree cutoff that always keeps
  // roughly the top 15% of nodes as "hubs" — but clamps the absolute count to
  // [3, 12] so a much bigger library never buries the map in bold labels, and
  // a tiny one always highlights at least a few.
  const degreeStats = useMemo(() => {
    const degrees = nodes.map((n) => n.degree ?? 0)
    const maxDegree = degrees.length ? Math.max(...degrees) : 0
    const hubCount = Math.max(3, Math.min(12, Math.round(nodes.length * 0.15)))
    const sorted = [...degrees].sort((a, b) => b - a)
    const hubThreshold = sorted.length ? Math.max(sorted[Math.min(hubCount, sorted.length) - 1], 3) : 3
    return { maxDegree, hubThreshold }
  }, [nodes])

  // Departments present, for the legend.
  const legend = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of nodes) counts.set(n.department, (counts.get(n.department) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [nodes])

  // Hues are assigned over the departments actually present (see buildDeptColors).
  const deptColor = useMemo(() => buildDeptColors(legend.map(([d]) => d)), [legend])

  // The set of node ids currently "in focus" (everything else is dimmed).
  // Precedence: a hovered/selected node lights itself + its neighbors; else a
  // search narrows to filename matches; else an active legend category isolates
  // that department. null = no focus (everything full-strength).
  const q = query.trim().toLowerCase()
  const focus = useMemo(() => {
    if (hoverId) {
      const s = new Set<string>([hoverId])
      for (const n of adjacency.get(hoverId) ?? []) s.add(n)
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
  }, [hoverId, q, activeDept, adjacency, nodes])

  // The node whose tooltip is shown while hovering.
  const tipId = hoverId
  const tip = tipId ? (nodes.find((n) => n.id === tipId) ?? null) : null

  const graphData = useMemo(
    () => ({
      // Biggest-degree nodes first so the smallest ones paint LAST. force-graph
      // resolves hover through a colour-indexed buffer where each node paints
      // over the last, so in the dense core a small dot whose hub neighbours
      // happened to come later in the array had its hit area buried under
      // theirs. Painting small-on-top keeps every node reachable (and stops
      // small dots hiding behind big ones visually, same ordering either way).
      nodes: [...nodes]
        .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))
        .map((n) => ({ ...n, name: n.filename })),
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
    [lens, findingsByDoc, deptColor],
  )

  // Screen radius for a node, relative to this graph's own degree spread (see
  // MIN_RADIUS/MAX_RADIUS/REFERENCE_NODE_COUNT above) rather than a fixed
  // formula tuned for one dataset size.
  const radius = useCallback(
    (degree: number) => {
      const norm = degreeStats.maxDegree > 0 ? Math.sqrt(degree / degreeStats.maxDegree) : 0
      const countScale = Math.min(1, Math.sqrt(REFERENCE_NODE_COUNT / Math.max(nodes.length, 1)))
      return (MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * norm) * countScale
    },
    [degreeStats.maxDegree, nodes.length],
  )

  // Tune the force simulation once nodes are present: strong-ish repulsion so
  // clusters breathe, moderate link distance so similarity edges pull
  // departments together.

  const zoomBy = useCallback((factor: number) => {
    const fg = fgRef.current
    if (!fg?.zoom) return
    fg.zoom(fg.zoom() * factor, 250)
  }, [])

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
        // distanceMax bounds how far repulsion reaches: d3's default charge has
        // no cutoff, so a 0-degree node (no link force pulling it anywhere) only
        // has this vs. the weak x/y gravity below to balance against — with an
        // unbounded charge that equilibrium can land arbitrarily far from the
        // cluster (a lone orphan node drifting off-screen). Capping it means
        // gravity always wins past this range and reels it back in.
        charge.strength(-150).distanceMax(260)
        fg.d3Force('link')?.distance(50).strength(0.3)
        // Disconnected/low-degree docs get pulled to center harder than
        // well-linked ones, which are already held in place by link forces —
        // keeps orphans near the cluster instead of drifting on their own.
        const gravity = (n: any) => (n.degree ? 0.22 : 0.55)
        fg.d3Force('x', forceX(0).strength(gravity))
        fg.d3Force('y', forceY(0).strength(gravity))
        fg.d3Force('collide', forceCollide((n: any) => radius(n.degree ?? 0) + 6))
        fg.d3ReheatSimulation?.()
        clearInterval(iv)
      } else if (++tries > 60) {
        clearInterval(iv)
      }
    }, 50)
    return () => clearInterval(iv)
  }, [nodes.length, edges.length, radius])

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
            className="w-48 rounded-full border border-line-control bg-paper-raised px-3.5 py-1.5 text-ink shadow-artifact placeholder:text-ink-soft focus:border-brain focus:outline-none"
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

        {/* Department legend — click a category to isolate it. Deliberately a
            toolbar row rather than an overlay floating on the canvas: as an
            absolutely-positioned box it covered ~12% of the graph, and because
            each row is a clickable filter button (pointer-events-auto) it ate
            the hover events of every node parked underneath it, making those
            documents unreachable. Out here it can't occlude anything. */}
        {legend.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-4 py-1.5">
            {legend.map(([dept, count]) => (
              <button
                key={dept}
                type="button"
                onClick={() => setActiveDept((p) => (p === dept ? null : dept))}
                data-on={activeDept === dept}
                style={{ opacity: activeDept && activeDept !== dept ? 0.45 : 1 }}
                className="flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-[0.7rem] text-ink-soft hover:bg-paper-sunk data-[on=true]:border-line data-[on=true]:bg-paper-sunk"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: deptColor(dept), boxShadow: `0 0 5px ${deptColor(dept)}` }}
                />
                <span className="text-ink">{dept}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        )}

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
                // force-graph's own built-in hover tooltip defaults to showing
                // node.name (the raw filename) in a plain browser-style label —
                // it was rendering right under our custom tooltip (which already
                // shows the filename + connections + department), so every
                // hover doubled up. Suppress the built-in one entirely.
                nodeLabel={() => ''}
                // Keep the render loop live after the graph settles. With the
                // default (paused) loop, hover detection only re-evaluates on the
                // occasional redraw, so a moving cursor skips most nodes — the
                // "only 1-2 nodes hover" bug. Live redraw makes hover track the
                // cursor every frame. (Cheap for this graph size.)
                autoPauseRedraw={false}
                onEngineStop={() => fgRef.current?.zoomToFit(500, 70)}
                onNodeHover={(n: any) => setHoverId(n ? String(n.id) : null)}
                onNodeClick={(n: any) =>
                  router.push(`/dashboard/sources?doc=${encodeURIComponent(String(n.id))}`)
                }
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
                  // Unfocused nodes recede to a single neutral tone rather than a
                  // faded version of their own hue — the whole graph reads as a
                  // quiet field of dots, and whatever IS focused is the only
                  // color on screen. Full alpha throughout: MUTED already sits
                  // low-contrast against paper, so it doesn't need fading too.
                  const color = dimmed ? MUTED : colorFor(node as DocNode)

                  // Soft color bloom behind focused nodes — a glow, not a hard
                  // ring, so a lit cluster feels like it's radiating rather than
                  // just being drawn in a brighter color. Only while something is
                  // actually focused: at rest every node would qualify as "not
                  // dimmed", and a permanent glow on all ~36 nodes is what made
                  // nearby hubs blob into each other instead of reading as
                  // distinct dots (the reference only glows on hover too).
                  if (focus && !dimmed) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, r + 3.5, 0, 2 * Math.PI)
                    ctx.fillStyle = color
                    ctx.globalAlpha = 0.16
                    ctx.fill()
                    ctx.globalAlpha = 1
                  }

                  // The hovered node pops: slightly larger with a violet ring, so
                  // it's unmistakable even for a hub whose neighbors stay lit.
                  const isHover = String(node.id) === hoverId
                  const rr = isHover ? r + 2.5 : r
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, rr, 0, 2 * Math.PI)
                  ctx.fillStyle = color
                  ctx.fill()
                  ctx.lineWidth = (isHover ? 2 : 1) / scale
                  ctx.strokeStyle = isHover ? '#684bff' : 'rgba(255,255,255,0.6)'
                  ctx.stroke()

                  const focused = focus ? focus.has(String(node.id)) : false
                  const isHub = (node.degree ?? 0) >= degreeStats.hubThreshold
                  const showLabel = focused || scale > 2.4 || isHub
                  if (showLabel && !dimmed) {
                    const label = shortName(String(node.name ?? ''))
                    // Hub documents read as cluster titles: bigger, bold, in
                    // their department color — a floating wordmark over the
                    // group they anchor, not just another node caption.
                    const weight = isHub ? 700 : 500
                    const baseSize = isHub ? 13 : 10
                    const fontSize = Math.max(baseSize / scale, 2.2)
                    ctx.font = `${weight} ${fontSize}px ui-sans-serif, system-ui, sans-serif`
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'top'
                    const y = node.y + r + 2
                    // Paper-colored outline stroke stands in for a halo box —
                    // legible over the edge mesh without boxing the label in.
                    ctx.lineJoin = 'round'
                    ctx.lineWidth = fontSize * 0.34
                    ctx.strokeStyle = '#F3EEE3'
                    ctx.strokeText(label, node.x, y)
                    ctx.fillStyle = isHub ? color : INK
                    ctx.fillText(label, node.x, y)
                  }
                  ctx.globalAlpha = 1
                }}
                nodePointerAreaPaint={(
                  node: any,
                  color: string,
                  ctx: CanvasRenderingContext2D,
                  scale: number,
                ) => {
                  // Hit-area with a screen-space floor (~10px) so even small,
                  // low-degree nodes are easy to hover regardless of zoom.
                  const r = radius(node.degree ?? 0)
                  const hit = Math.max(r + 3, 10 / (scale || 1))
                  ctx.fillStyle = color
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, hit, 0, 2 * Math.PI)
                  ctx.fill()

                  // The label is a hit target too. At this document count a dot
                  // is only a few px across while its filename caption is by far
                  // the biggest thing on screen, so aiming at the text — the
                  // obvious thing to do — used to hover nothing at all. Mirrors
                  // the showLabel/geometry logic in nodeCanvasObject above; keep
                  // the two in step.
                  const dimmed = focus ? !focus.has(String(node.id)) : false
                  const focused = focus ? focus.has(String(node.id)) : false
                  const isHub = (node.degree ?? 0) >= degreeStats.hubThreshold
                  if ((focused || scale > 2.4 || isHub) && !dimmed) {
                    const fontSize = Math.max((isHub ? 13 : 10) / scale, 2.2)
                    ctx.font = `${isHub ? 700 : 500} ${fontSize}px ui-sans-serif, system-ui, sans-serif`
                    const w = ctx.measureText(shortName(String(node.name ?? ''))).width
                    ctx.fillRect(node.x - w / 2, node.y + r + 2, w, fontSize)
                  }
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

          {/* Map stats + interaction hint — bottom-right, chrome-less. */}
          <div className="pointer-events-none absolute bottom-3 right-3 text-right text-[0.7rem] text-ink-soft">
            <div className="tabular-nums">
              {nodes.length} document{nodes.length === 1 ? '' : 's'} · {edges.length} connection
              {edges.length === 1 ? '' : 's'} · {legend.length} department{legend.length === 1 ? '' : 's'}
            </div>
            <div className="opacity-70">Hover to focus · click to open</div>
          </div>

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

          {/* Floating zoom controls, top-right — a discoverable alternative to
              the wheel/pinch gesture, matching the reference's control cluster. */}
          {nodes.length > 0 && (
            <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1.5">
              {[
                { label: '+', title: 'Zoom in', onClick: () => zoomBy(1.4) },
                { label: '–', title: 'Zoom out', onClick: () => zoomBy(1 / 1.4) },
                { label: '⛶', title: 'Fit to screen', onClick: () => fgRef.current?.zoomToFit(400, 70) },
              ].map((btn) => (
                <button
                  key={btn.title}
                  type="button"
                  title={btn.title}
                  onClick={btn.onClick}
                  className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper-raised/90 text-ink-soft shadow-artifact hover:text-ink"
                >
                  {btn.label}
                </button>
              ))}
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
