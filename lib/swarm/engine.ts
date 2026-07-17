import type { Artifact, ArtifactKind, SceneId, Slot, SwarmOpts, Telemetry } from './types'
import { buildAtlas, labelFor, spriteKey, KINDS, VARIANTS, type SpriteAtlas } from './artifacts'
import { readPalette, withAlpha, type SwarmPalette } from './tokens'
import {
  buildGeometry,
  fieldFor,
  mulberry32,
  resolveStatic,
  resolveTargets,
  type Geometry,
} from './scenes'

/**
 * ============================================================================
 * THE SWARM ENGINE
 * ============================================================================
 * One canvas, one rAF loop, one pool of artifacts that lives for the whole page.
 *
 * The central constraint: the SAME objects must persist across every scene. The
 * email that gets buried in scene 2 is the same email ingested in scene 3 and
 * assembled into a card in scene 6. That continuity is the story, and it is why
 * this is a single fixed canvas rather than one per section.
 *
 * PERFORMANCE RULES (violating these is a bug, not a style opinion):
 *   - Zero allocation inside frame(). No object literals, no closures, no
 *     .map/.filter. Everything is preallocated and mutated in place.
 *   - Cards are never path-drawn per frame — only blitted from the sprite atlas.
 *   - getComputedStyle/getBoundingClientRect are init/resize only.
 *   - The loop stops dead when the canvas is offscreen or the tab is hidden.
 */

const GOLDEN = 2.399963

/** Which lattice nodes the scene-4 answer cites. Stable so the lines never jump. */
const CITE_NODES = [3, 11, 24]

export class SwarmEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private opts: SwarmOpts
  private palette: SwarmPalette

  private arts: Artifact[] = []
  private atlas: SpriteAtlas = new Map()
  private geo: Geometry

  private dpr = 1
  private w = 0
  private h = 0

  private scene: SceneId = 'hero'
  private progress = 0
  private slots: Slot[] = []
  private citeAnchor = { x: 0, y: 0, active: false }

  private pointer = { x: -9999, y: -9999, has: false }
  private raf = 0
  private running = false
  private startedAt = 0

  /** Preallocated force accumulators — reused every frame, never reallocated. */
  private fx: Float32Array
  private fy: Float32Array

  private telemetry: Telemetry

  constructor(canvas: HTMLCanvasElement, opts: SwarmOpts) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('SwarmEngine: 2D context unavailable')
    this.ctx = ctx
    this.opts = opts
    this.palette = readPalette()

    this.fx = new Float32Array(opts.count)
    this.fy = new Float32Array(opts.count)

    this.geo = buildGeometry(1, 1, opts.count)

    // Under reduced motion the swarm never plays the screenplay — it holds the
    // ENDING as one still frame. So it starts in a resolved scene, before any
    // draw can happen (resize() renders a static frame, and it can run before
    // start()). Leaving it on 'hero' made the rail report "scattered" over a
    // picture of an organized brain, and faded the lattice edges to nothing.
    if (opts.reducedMotion) {
      this.scene = 'proof'
      this.progress = 1
    }

    this.telemetry = {
      indexed: 0,
      total: opts.count,
      cited: 0,
      queries: 0,
      egress: 0,
      scene: this.scene,
    }

    this.pool()
    // Total is the count of UNIQUE artifacts, set after pooling assigns
    // duplicates. Reporting the raw pool size instead would top out at e.g.
    // "57/70 indexed" once the duplicates merged — reading as 13 failures when
    // in fact merging them is the product working correctly.
    this.telemetry.total = this.liveCount
    this.resize()
  }

  /* ---------------------------------------------------------------------- */
  /* init                                                                    */
  /* ---------------------------------------------------------------------- */

  /** Allocate the pool ONCE. After this, no Artifact is ever constructed again. */
  private pool() {
    const rand = mulberry32(0xc0ffee)
    const n = this.opts.count
    this.arts.length = 0

    for (let i = 0; i < n; i++) {
      const kind: ArtifactKind = KINDS[i % KINDS.length]
      const variant = Math.floor(rand() * VARIANTS)
      this.arts.push({
        kind,
        variant,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        vrot: 0,
        tx: 0,
        ty: 0,
        trot: 0,
        scale: 1,
        opacity: 1,
        seed: rand(),
        seedB: rand(),
        label: labelFor(kind, variant),
        node: i,
        lost: false,
        dupOf: -1,
        merge: 0,
        hover: 0,
      })
    }

    // ~18% duplicates and ~12% lost. The texture of a real company's drive:
    // four versions of the same file, and knowledge that walked out the door.
    // Duplicates always point at a NON-duplicate so merging terminates.
    const dupCount = Math.floor(n * 0.18)
    for (let i = 0; i < dupCount; i++) {
      const d = this.arts[n - 1 - i]
      const originalIdx = Math.floor(rand() * (n - dupCount))
      d.dupOf = originalIdx
      d.kind = this.arts[originalIdx].kind
      d.variant = this.arts[originalIdx].variant
      d.label = this.arts[originalIdx].label
    }
    for (let i = 0; i < n; i++) {
      if (this.arts[i].dupOf < 0 && rand() < 0.12) this.arts[i].lost = true
    }

    // Lattice slots go only to survivors, so the resolved brain has no holes
    // where a merged duplicate used to be.
    let slot = 0
    for (let i = 0; i < n; i++) {
      if (this.arts[i].dupOf < 0) this.arts[i].node = slot++
    }
    for (let i = 0; i < n; i++) {
      if (this.arts[i].dupOf >= 0) this.arts[i].node = this.arts[this.arts[i].dupOf].node
    }
    this.liveCount = slot

    // Reverse map: lattice slot -> artifact index. Built once, so draw() can
    // find the artifact occupying a node WITHOUT searching every frame.
    this.nodeToArt = new Int32Array(slot)
    for (let i = 0; i < n; i++) {
      if (this.arts[i].dupOf < 0) this.nodeToArt[this.arts[i].node] = i
    }
  }

  private liveCount = 0
  /** lattice slot -> index into arts. See pool(). */
  private nodeToArt = new Int32Array(0)

  /* ---------------------------------------------------------------------- */
  /* public API                                                              */
  /* ---------------------------------------------------------------------- */

  setScene(scene: SceneId, progress: number) {
    this.scene = scene
    this.progress = progress < 0 ? 0 : progress > 1 ? 1 : progress
    this.telemetry.scene = scene
  }

  setPointer(x: number, y: number) {
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.has = true
  }

  clearPointer() {
    this.pointer.has = false
    this.pointer.x = -9999
    this.pointer.y = -9999
  }

  /** Feature-card rects the swarm assembles into (scene 6). Viewport coords. */
  setSlots(slots: Slot[]) {
    this.slots = slots
  }

  /** Where the scene-4 answer sits, so citation lines can reach it. */
  setCiteAnchor(x: number, y: number, active: boolean) {
    this.citeAnchor.x = x
    this.citeAnchor.y = y
    this.citeAnchor.active = active
  }

  getTelemetry(): Telemetry {
    return this.telemetry
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.w = rect.width || window.innerWidth
    this.h = rect.height || window.innerHeight
    // Cap DPR at 2: beyond that we are paying 3-4x fill rate for a difference
    // nobody can see on a moving object.
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.lowPower ? 1 : 2)

    this.canvas.width = Math.floor(this.w * this.dpr)
    this.canvas.height = Math.floor(this.h * this.dpr)

    this.geo = buildGeometry(this.w, this.h, this.liveCount || this.opts.count)
    this.atlas = buildAtlas(this.palette, this.dpr, this.opts.lowPower)

    // Seed positions the first time we ever size, so nothing flies in from 0,0.
    if (this.startedAt === 0) {
      const rand = mulberry32(0x5eed)
      for (const a of this.arts) {
        a.x = this.geo.wall.x + rand() * this.geo.wall.w
        a.y = this.geo.wall.y + rand() * this.geo.wall.h
        a.rot = (a.seed - 0.5) * 0.85
      }
    }

    if (this.opts.reducedMotion) {
      resolveStatic(this.arts, this.geo)
      this.draw(0)
    }
  }

  start() {
    if (this.running) return
    // Reduced motion: one static composition, no loop. The story's ending,
    // held as a single frame.
    if (this.opts.reducedMotion) {
      // Scene is already 'proof' (resolved) from the constructor.
      resolveStatic(this.arts, this.geo)
      this.telemetry.indexed = this.liveCount
      this.telemetry.cited = CITE_NODES.length
      this.draw(0)
      return
    }
    this.running = true
    this.startedAt = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  destroy() {
    this.stop()
    this.atlas.clear()
    this.arts.length = 0
  }

  /* ---------------------------------------------------------------------- */
  /* simulation                                                              */
  /* ---------------------------------------------------------------------- */

  private frame = (now: number) => {
    if (!this.running) return
    this.step(now)
    this.draw(now)
    this.raf = requestAnimationFrame(this.frame)
  }

  private step(now: number) {
    const arts = this.arts
    const n = arts.length
    const f = fieldFor(this.scene, this.progress)
    const { wall } = this.geo

    resolveTargets(arts, this.scene, this.progress, this.geo, this.slots, now)

    // ---- boids: separation / alignment / cohesion -----------------------
    // O(n^2) with n<=70 is ~5k iterations per frame. That is nothing, and it
    // buys real flocking rather than fake noise.
    const fx = this.fx
    const fy = this.fy
    fx.fill(0)
    fy.fill(0)

    if (f.chaos > 0.02) {
      const SEP = 46
      const SEP2 = SEP * SEP
      const NEIGH2 = 150 * 150
      for (let i = 0; i < n; i++) {
        const a = arts[i]
        if (a.opacity <= 0.02) continue
        let sepX = 0
        let sepY = 0
        let aliX = 0
        let aliY = 0
        let cohX = 0
        let cohY = 0
        let count = 0

        for (let j = 0; j < n; j++) {
          if (i === j) continue
          const b = arts[j]
          if (b.opacity <= 0.02) continue
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 > NEIGH2 || d2 === 0) continue

          if (d2 < SEP2) {
            const inv = 1 / Math.sqrt(d2)
            sepX += dx * inv
            sepY += dy * inv
          }
          aliX += b.vx
          aliY += b.vy
          cohX += b.x
          cohY += b.y
          count++
        }

        if (count > 0) {
          aliX /= count
          aliY /= count
          cohX = cohX / count - a.x
          cohY = cohY / count - a.y
        }

        // Separation is weighted heavily and cohesion barely at all: this swarm
        // must look SCATTERED, not flocked. Cohesion is what balls a flock
        // together — great for starlings, wrong for a mess on a desk. It stays
        // only to keep neighbours loosely aware of each other.
        fx[i] += (sepX * 0.11 + aliX * 0.01 + cohX * 0.00008) * f.chaos
        fy[i] += (sepY * 0.11 + aliY * 0.01 + cohY * 0.00008) * f.chaos
      }
    }

    // ---- integrate ------------------------------------------------------
    const leanX = this.pointer.has ? this.pointer.x : 0
    const leanY = this.pointer.has ? this.pointer.y : 0

    for (let i = 0; i < n; i++) {
      const a = arts[i]

      // spring toward the scene's target
      a.vx += (a.tx - a.x) * f.k * f.order + fx[i]
      a.vy += (a.ty - a.y) * f.k * f.order + fy[i]

      // the swarm leans subtly toward the cursor
      if (this.pointer.has && f.lean > 0) {
        const dx = leanX - a.x
        const dy = leanY - a.y
        const d2 = dx * dx + dy * dy
        if (d2 > 1 && d2 < 340 * 340) {
          const inv = 1 / Math.sqrt(d2)
          // attract near the brain, repel hard at very close range so the
          // cursor parts the swarm rather than swallowing it
          const strength = d2 < 70 * 70 ? -0.5 : 0.11
          a.vx += dx * inv * strength * f.lean
          a.vy += dy * inv * strength * f.lean
        }
      }

      a.vx *= f.damp
      a.vy *= f.damp

      // clamp speed — a runaway artifact reads as a bug, not as energy
      const sp2 = a.vx * a.vx + a.vy * a.vy
      if (sp2 > 64) {
        const s = 8 / Math.sqrt(sp2)
        a.vx *= s
        a.vy *= s
      }

      a.x += a.vx
      a.y += a.vy

      // rotation eases toward target
      a.rot += (a.trot - a.rot) * 0.06

      // ---- THE WALL: nothing ever crosses out ---------------------------
      // This is the on-prem promise expressed as a physics constraint rather
      // than a sentence. Data reaches the boundary and comes back. Always.
      const m = 14
      if (a.x < wall.x + m) {
        a.x = wall.x + m
        a.vx = Math.abs(a.vx) * 0.62
      } else if (a.x > wall.x + wall.w - m) {
        a.x = wall.x + wall.w - m
        a.vx = -Math.abs(a.vx) * 0.62
      }
      if (a.y < wall.y + m) {
        a.y = wall.y + m
        a.vy = Math.abs(a.vy) * 0.62
      } else if (a.y > wall.y + wall.h - m) {
        a.y = wall.y + wall.h - m
        a.vy = -Math.abs(a.vy) * 0.62
      }

      // hover reveal
      let want = 0
      if (this.pointer.has) {
        const dx = this.pointer.x - a.x
        const dy = this.pointer.y - a.y
        if (dx * dx + dy * dy < 30 * 30) want = 1
      }
      a.hover += (want - a.hover) * 0.16
    }

    // ---- telemetry: real state, not decoration --------------------------
    const order = f.order
    this.telemetry.indexed = Math.round(this.liveCount * Math.min(1, order))
    this.telemetry.cited =
      this.scene === 'ask' || this.scene === 'proof' || this.scene === 'cta' ? CITE_NODES.length : 0
    this.telemetry.queries = this.scene === 'ask' ? 1 : 0
  }

  /* ---------------------------------------------------------------------- */
  /* render                                                                  */
  /* ---------------------------------------------------------------------- */

  private draw(now: number) {
    const ctx = this.ctx
    const p = this.palette
    const { edges } = this.geo

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)

    const f = fieldFor(this.scene, this.progress)

    this.drawPerimeter(now, f.order)

    // ---- filament edges: the brain's connective tissue ------------------
    // They only exist once there IS an index, so they fade in with `order` —
    // the connections literally appear as the mess resolves.
    //
    // Drawn between the artifacts' LIVE positions, not the static lattice
    // coordinates. Anchoring them to the lattice left a giant web sprawling
    // across the viewport whenever the artifacts moved off their nodes (the CTA
    // core, the feature cards) — edges connecting nothing to nothing.
    // An edge is a relationship between two artifacts; it follows them.
    const edgeAlpha = this.edgeAlpha(f.order)
    if (edgeAlpha > 0.01) {
      ctx.strokeStyle = withAlpha(p.brain, edgeAlpha)
      ctx.lineWidth = 0.7
      ctx.beginPath()
      for (let e = 0; e < edges.length; e += 2) {
        const a = this.arts[this.nodeToArt[edges[e]]]
        const b = this.arts[this.nodeToArt[edges[e + 1]]]
        if (!a || !b) continue
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
    }

    // ---- artifacts ------------------------------------------------------
    const arts = this.arts
    for (let i = 0; i < arts.length; i++) {
      const a = arts[i]
      if (a.opacity <= 0.015) continue

      const sprite = this.atlas.get(spriteKey(a.kind, a.variant))
      if (!sprite) continue

      ctx.save()
      ctx.translate(a.x, a.y)
      ctx.rotate(a.rot)

      // "Lost" artifacts desaturate toward the paper — knowledge greying out.
      ctx.globalAlpha = a.opacity
      const sc = a.scale * (1 - a.merge * 0.35)
      if (sc !== 1) ctx.scale(sc, sc)

      ctx.drawImage(sprite.canvas, -sprite.cx, -sprite.cy, sprite.w, sprite.h)
      ctx.restore()
    }

    // ---- citation lines: the strongest thing on screen in scene 4 -------
    if (this.scene === 'ask' && this.citeAnchor.active) {
      this.drawCitations(now)
    }

    // ---- the query packet ----------------------------------------------
    if (this.scene === 'ask') this.drawQueryPacket(now)

    // ---- the hostile packet, repelled at the wall -----------------------
    if (this.scene === 'sovereign') this.drawIntrusion(now)

    // ---- hover label ----------------------------------------------------
    this.drawHoverLabel()

    ctx.globalAlpha = 1
  }

  /**
   * How visible the connective filaments are, per scene.
   *
   * In 'features' the artifacts have left the brain to become the outlines of
   * the feature cards — drawing the lattice there means long edges crisscrossing
   * between five distant card rectangles, which reads as spaghetti rather than
   * as structure. The brain is not the subject of that scene; the cards are.
   */
  private edgeAlpha(order: number): number {
    if (order <= 0.12) return 0
    const base = (order - 0.12) * 0.5
    if (this.scene === 'features') return base * 0.12
    return base
  }

  /**
   * The perimeter — "your walls". A thin confident blueprint line that pulses
   * --sovereign on key beats. It is drawn FIRST and it is always there: the one
   * constant the whole page is framed by.
   */
  private drawPerimeter(now: number, order: number) {
    const ctx = this.ctx
    const p = this.palette
    const { wall } = this.geo

    // Pulse once when the ingestion completes ("and none of it left your
    // walls"), and beat slowly at the CTA.
    let pulse = 0
    if (this.scene === 'turn') {
      const t = this.progress
      // a single clean pulse as order lands
      pulse = t > 0.72 ? Math.max(0, Math.sin((t - 0.72) * 6.5 * Math.PI)) * 0.9 : 0
    } else if (this.scene === 'sovereign') {
      pulse = 0.28 + Math.abs(Math.sin(now * 0.0011)) * 0.45
    } else if (this.scene === 'cta') {
      // slow heartbeat
      const b = (now * 0.00042) % 1
      pulse = Math.max(0, Math.sin(b * Math.PI * 2)) * 0.5
    }

    ctx.lineWidth = 1
    ctx.strokeStyle = withAlpha(p.inkSoft, 0.3 + order * 0.12)
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h)

    if (pulse > 0.01) {
      ctx.lineWidth = 1.6
      ctx.strokeStyle = withAlpha(p.sovereign, pulse)
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h)
    }

    // blueprint register marks — technical drawing, not decoration
    ctx.strokeStyle = withAlpha(p.inkSoft, 0.45)
    ctx.lineWidth = 1
    const L = 9
    ctx.beginPath()
    for (const [cx, cy] of [
      [wall.x, wall.y],
      [wall.x + wall.w, wall.y],
      [wall.x, wall.y + wall.h],
      [wall.x + wall.w, wall.y + wall.h],
    ]) {
      ctx.moveTo(cx - L, cy)
      ctx.lineTo(cx + L, cy)
      ctx.moveTo(cx, cy - L)
      ctx.lineTo(cx, cy + L)
    }
    ctx.stroke()
  }

  /**
   * Scene 4's whole reason to exist: every clause of the answer draws a live
   * line back to the exact artifact it came from. Nothing is asserted without a
   * visible source.
   */
  private drawCitations(now: number) {
    const ctx = this.ctx
    const p = this.palette
    const ax = this.citeAnchor.x
    const ay = this.citeAnchor.y

    for (let c = 0; c < CITE_NODES.length; c++) {
      const ni = CITE_NODES[c] % Math.max(1, this.liveCount)
      // Live artifact position, not the lattice slot: a citation must land on
      // the source you can actually SEE, or it is pointing at nothing.
      const src = this.arts[this.nodeToArt[ni]]
      if (!src) continue
      const nx = src.x
      const ny = src.y

      // stagger the draw-on so the three lines read as three separate facts
      const t = Math.min(1, Math.max(0, (now * 0.0012 - c * 0.5) % 3))
      const reveal = Math.min(1, t * 1.6)
      if (reveal <= 0) continue

      const mx = (ax + nx) / 2
      const my = (ay + ny) / 2 - 40

      ctx.strokeStyle = withAlpha(p.brain, 0.85)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(ax, ay + c * 14 - 14)
      // quadratic toward the source — curved so three lines never overlap
      const ex = ax + (nx - ax) * reveal
      const ey = ay + (ny - ay) * reveal
      ctx.quadraticCurveTo(mx, my, ex, ey)
      ctx.stroke()

      if (reveal >= 0.98) {
        // the source node, ringed
        ctx.strokeStyle = withAlpha(p.brain, 0.9)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(nx, ny, 17 + Math.sin(now * 0.003 + c) * 1.5, 0, Math.PI * 2)
        ctx.stroke()

        // the [n] marker
        ctx.fillStyle = p.brain
        ctx.beginPath()
        ctx.arc(nx, ny - 24, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = p.paperRaised
        ctx.font = '600 9px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(c + 1), nx, ny - 23.5)
        ctx.textAlign = 'start'
        ctx.textBaseline = 'alphabetic'
      }
    }
  }

  /** A live question moving through the system, in --query. */
  private drawQueryPacket(now: number) {
    const ctx = this.ctx
    const p = this.palette
    const { edges } = this.geo
    if (edges.length === 0) return

    const SPEED = 0.00055
    for (let k = 0; k < 3; k++) {
      const t = (now * SPEED + k * 0.37) % 1
      const ei = (Math.floor(now * SPEED * 0.5 + k * 3) * 2) % edges.length
      // Ride the LIVE artifacts, so the packet travels the same filaments the
      // eye can see rather than an invisible parallel graph.
      const a = this.arts[this.nodeToArt[edges[ei]]]
      const b = this.arts[this.nodeToArt[edges[ei + 1]]]
      if (!a || !b) continue

      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t

      ctx.fillStyle = withAlpha(p.query, 0.9)
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
      // a short comet tail, no glow — this is paper, not neon
      const tail = Math.max(0, t - 0.08)
      ctx.strokeStyle = withAlpha(p.query, 0.28)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  /**
   * Scene 5: something from OUTSIDE tries to get in and is turned away at the
   * wall. The perimeter is doing its job, visibly.
   */
  private drawIntrusion(now: number) {
    const ctx = this.ctx
    const p = this.palette
    const { wall } = this.geo

    const cycle = (now * 0.00035) % 1
    // approach, hit, recoil
    const approach = Math.min(1, cycle * 2.2)
    const hit = cycle > 0.45 && cycle < 0.62
    const recoil = cycle > 0.45 ? (cycle - 0.45) * 2.4 : 0

    const startX = wall.x - 60
    const targetX = wall.x - 2
    const y = wall.y + wall.h * 0.42

    const x = startX + (targetX - startX) * approach - recoil * 70

    if (cycle < 0.95) {
      ctx.fillStyle = withAlpha(p.sovereign, 0.9 * (1 - recoil))
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    if (hit) {
      // the wall answers
      const s = (cycle - 0.45) / 0.17
      ctx.strokeStyle = withAlpha(p.sovereign, 0.85 * (1 - s))
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(wall.x, y, 6 + s * 34, -Math.PI / 2.2, Math.PI / 2.2)
      ctx.stroke()
    }
  }

  /** On hover, an artifact says what it actually is. */
  private drawHoverLabel() {
    const ctx = this.ctx
    const p = this.palette

    for (let i = 0; i < this.arts.length; i++) {
      const a = this.arts[i]
      if (a.hover < 0.05 || a.opacity < 0.2) continue

      ctx.globalAlpha = a.hover
      ctx.font = '400 10px ui-monospace, "IBM Plex Mono", monospace'
      const tw = ctx.measureText(a.label).width
      const bx = a.x + 16
      const by = a.y - 26

      ctx.fillStyle = withAlpha(p.ink, 0.92)
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath()
        ctx.roundRect(bx, by, tw + 14, 19, 3)
        ctx.fill()
      } else {
        ctx.fillRect(bx, by, tw + 14, 19)
      }

      ctx.fillStyle = p.paper
      ctx.textBaseline = 'middle'
      ctx.fillText(a.label, bx + 7, by + 10)
      ctx.textBaseline = 'alphabetic'
      ctx.globalAlpha = 1
    }
  }
}

export { GOLDEN }
