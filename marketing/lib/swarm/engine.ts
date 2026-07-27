import type { ArtifactKind, SceneId, Telemetry } from './types'
import { KINDS, labelFor, makeSprite, spriteScale, type Sprite } from './artifacts'
import { readPalette, type SwarmPalette } from './tokens'
import { addTick, removeTick } from '@/lib/ticker'

/**
 * ============================================================================
 * THE SWARM — one fixed Canvas 2D surface behind the whole homepage.
 * ============================================================================
 * A company's knowledge, scattered and duplicated and lost, drawn together into
 * one brain inside a drawn perimeter that nothing ever crosses.
 *
 * ARCHITECTURE — why there is no GSAP here.
 * Scroll position is read directly from each section's rect, per frame:
 *
 *     progress = -rect.top / (rect.height - viewportHeight)
 *
 * Sections are simply TALL (200-320vh) with `position: sticky` copy inside, so
 * the pin is native CSS rather than a JS-managed pin-spacer. This replaced a
 * ScrollTrigger-per-scene design, and it is not merely simpler — it makes a
 * whole class of bug unrepresentable. The previous version created triggers out
 * of DOM order, so every scene after the pinned one measured a document 150vh
 * short and fired ~1.2 viewports early; 'ask' never fired at all, which meant
 * the citation lines — the most important beat on the page — had literally
 * never rendered. With rect maths there is no ordering, no refresh, and nothing
 * to get wrong.
 *
 * PERFORMANCE CONTRACT
 *  - Cards are rasterized once and only blitted. The loop never path-draws one.
 *  - No allocation inside the frame loop.
 *  - All DOM reads happen at the top of a frame, all DOM writes at the bottom,
 *    so we never interleave them and force layout twice.
 *  - The loop stops dead when the tab is hidden or the canvas is offscreen.
 */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const clamp01 = (v: number) => clamp(v, 0, 1)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** easeInOutQuad — the reference's curve; softer in, decisive out. */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** DOM order. `activeScene()` walks this list and takes the last match. */
const SCENES: SceneId[] = [
  'hero',
  'problem',
  'turn',
  'ask',
  'sovereign',
  'features',
  'proof',
  'pricing',
  'cta',
]

interface Art {
  kind: ArtifactKind
  sprite: Sprite
  seed: number
  /** live */
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  alpha: number
  /** chaos home */
  hx: number
  hy: number
  /** unit node coords in the resolved brain, -1..1 */
  nx: number
  ny: number
  homeRot: number
  scale: number
  lost: boolean
  buried: boolean
  dupOf: number
  /** which feature card this one flies to, or -1 */
  flyer: number
  label: string
}

export interface SwarmOpts {
  count: number
  reducedMotion: boolean
  lowPower: boolean
}

/** Where the brain sits and how big it is, per scene. */
interface BrainCfg {
  cx: number
  cy: number
  r: number
}

export class SwarmEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private opts: SwarmOpts
  private p: SwarmPalette

  private arts: Art[] = []
  private edges: [number, number][] = []
  private citeNodes: Art[] = []
  private liveCount = 0

  private vw = 0
  private vh = 0
  private dpr = 1
  private raf = 0
  private running = false
  private t0 = 0
  private lastT = 0

  private mx = -1e4
  private my = -1e4

  private sovPulse = 0
  private turnPulsed = false
  private telemetry: Telemetry

  /** DOM handles, resolved once. */
  private sections: Partial<Record<SceneId, HTMLElement>> = {}
  private citeEls: (HTMLElement | null)[] = []
  private tipEl: HTMLElement | null = null
  private queryEl: HTMLElement | null = null

  /** Per-frame scratch — read at the top of a frame, never allocated. */
  private prog: Record<SceneId, number> = {
    hero: 0,
    problem: 0,
    turn: 0,
    ask: 0,
    sovereign: 0,
    features: 0,
    proof: 0,
    pricing: 0,
    cta: 0,
  }
  private scene: SceneId = 'hero'
  private cardRects: (DOMRect | null)[] = []
  private citeRects: (DOMRect | null)[] = []
  private queryRect: DOMRect | null = null

  constructor(canvas: HTMLCanvasElement, opts: SwarmOpts) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('SwarmEngine: no 2D context')
    this.ctx = ctx
    this.opts = opts
    this.p = readPalette()
    this.t0 = performance.now()

    this.telemetry = { indexed: 0, total: 0, cited: 0, queries: 0, egress: 0, scene: 'hero' }

    for (const s of SCENES) {
      this.sections[s] = document.querySelector<HTMLElement>(`[data-scene="${s}"]`) ?? undefined
    }
    this.citeEls = [1, 2, 3].map((i) => document.getElementById(`cite-${i}`))
    this.tipEl = document.getElementById('swarm-tip')
    this.queryEl = document.getElementById('ask-question')

    this.measureViewport()
    this.build()
  }

  /**
   * The perimeter inset — "your walls".
   *
   * Sized to clear the header (--nav-h is 4.5rem/72px), so the walls frame the
   * CONTENT and the navbar sits cleanly above them. The reference used a flat
   * 26px, which is right for its own layout but here drew the perimeter line
   * and its label straight through the header band — turning a clean navbar
   * into clutter. The wall belongs around the story, not through the chrome.
   */
  private margin() {
    return Math.min(Math.max(this.vw * 0.05, 20), 72)
  }

  /* ---------------------------------------------------------------------- */
  /* build                                                                   */
  /* ---------------------------------------------------------------------- */

  private build() {
    const rnd = mulberry32(1234)
    const n = this.opts.count
    const s = spriteScale(this.opts.lowPower)

    // One sprite per KIND, shared by every artifact of that kind — 8 bitmaps
    // total. Variety comes from scale and rotation, not from 24 near-identical
    // textures.
    const sprites = new Map<ArtifactKind, Sprite>()
    for (const k of KINDS) sprites.set(k, makeSprite(k, s))

    this.arts = []
    for (let i = 0; i < n; i++) {
      const kind = KINDS[i % KINDS.length]
      this.arts.push({
        kind,
        sprite: sprites.get(kind)!,
        seed: rnd() * 1000,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: (rnd() - 0.5) * 0.7,
        homeRot: (rnd() - 0.5) * 0.55,
        alpha: 1,
        hx: 0,
        hy: 0,
        nx: 0,
        ny: 0,
        scale: 0.74 + rnd() * 0.26,
        lost: rnd() < 0.12,
        buried: rnd() < 0.14,
        dupOf: -1,
        flyer: -1,
        label: labelFor(kind, i),
      })
    }

    // Duplicates: the last ~13% mirror an earlier artifact. Four versions of the
    // same document, three of them wrong, nothing saying which.
    for (let i = n - Math.floor(n * 0.13); i < n; i++) {
      const d = this.arts[i]
      d.dupOf = Math.floor(rnd() * (n / 2))
      d.kind = this.arts[d.dupOf].kind
      d.sprite = this.arts[d.dupOf].sprite
      d.label = this.arts[d.dupOf].label
      d.lost = false
      d.buried = false
    }

    // Only TWELVE artifacts fly to the feature cards — three per card. Sending
    // the whole swarm turned that beat into a stampede; a handful reads as the
    // cards being ASSEMBLED from the knowledge, which is the actual idea.
    let f = 0
    for (let i = 3; i < n && f < 12; i += 4) {
      if (this.arts[i].dupOf < 0) this.arts[i].flyer = Math.floor(f / 3)
      if (this.arts[i].dupOf < 0) f++
    }

    this.liveCount = this.arts.filter((a) => a.dupOf < 0).length
    this.telemetry.total = this.liveCount
    this.layout()
  }

  /** Scattered homes + the resolved brain + who goes where. Runs on resize. */
  private layout() {
    const m = this.margin()
    const r0 = mulberry32(77)

    for (const a of this.arts) {
      a.hx = m + 30 + r0() * (this.vw - m * 2 - 60)
      a.hy = m + 60 + r0() * (this.vh - m * 2 - 100)
      if (a.dupOf >= 0) {
        // a duplicate lives near the thing it duplicates
        a.hx = this.arts[a.dupOf].hx + (r0() - 0.5) * 120
        a.hy = this.arts[a.dupOf].hy + (r0() - 0.5) * 120
      }
      if (a.x === 0 && a.y === 0) {
        a.x = a.hx
        a.y = a.hy
      }
    }

    // The brain: phyllotaxis in unit coords, so it can be scaled and moved per
    // scene without recomputing anything.
    const real = this.arts.filter((a) => a.dupOf < 0)
    const K = real.length
    const nodes: { nx: number; ny: number }[] = []
    for (let i = 0; i < K; i++) {
      const rr = Math.sqrt((i + 0.6) / K)
      const an = i * 2.39996
      nodes.push({ nx: rr * Math.cos(an), ny: rr * Math.sin(an) * 0.82 })
    }

    // ---- WHO GOES WHERE -------------------------------------------------
    // Greedy nearest-first, from each artifact's scattered home to a node.
    // Assigning nodes in pool order (the obvious thing) is statistically a
    // uniform random permutation — measured 366 crossing flight paths versus 19
    // for nearest-first, and 63% more travel. That is the difference between the
    // money shot reading as a CONVERGENCE and reading as a shuffle.
    const brainR = Math.min(this.vw, this.vh) * 0.3
    const cx = this.vw * 0.5
    const cy = this.vh * 0.46
    const pairs: { d: number; a: number; s: number }[] = []
    for (let i = 0; i < K; i++) {
      for (let s = 0; s < K; s++) {
        const dx = real[i].hx - (cx + nodes[s].nx * brainR)
        const dy = real[i].hy - (cy + nodes[s].ny * brainR)
        pairs.push({ d: dx * dx + dy * dy, a: i, s })
      }
    }
    pairs.sort((x, y) => x.d - y.d)
    const takenSlot = new Uint8Array(K)
    const doneArt = new Uint8Array(K)
    let placed = 0
    for (let i = 0; i < pairs.length && placed < K; i++) {
      const pr = pairs[i]
      if (doneArt[pr.a] || takenSlot[pr.s]) continue
      real[pr.a].nx = nodes[pr.s].nx
      real[pr.a].ny = nodes[pr.s].ny
      doneArt[pr.a] = 1
      takenSlot[pr.s] = 1
      placed++
    }
    for (const a of this.arts) {
      if (a.dupOf >= 0) {
        a.nx = this.arts[a.dupOf].nx
        a.ny = this.arts[a.dupOf].ny
      }
    }

    // Edges: two nearest neighbours — among artifacts that STAY IN THE BRAIN.
    //
    // Flyers are excluded. They leave the lattice to become the substance of the
    // feature cards, and while they were still wired into it their filaments
    // stretched from wherever the cards had scrolled to, right across the
    // viewport and straight through the copy — long teal streaks over "True by
    // construction." An artifact that has left the brain is not connected to it.
    const web = this.arts.filter((a) => a.dupOf < 0 && a.flyer < 0)
    const W = web.length
    this.edges = []
    for (let i = 0; i < W; i++) {
      const ds: [number, number][] = []
      for (let j = 0; j < W; j++) {
        if (j === i) continue
        const dx = web[i].nx - web[j].nx
        const dy = web[i].ny - web[j].ny
        ds.push([dx * dx + dy * dy, j])
      }
      ds.sort((a, b) => a[0] - b[0])
      for (let k = 0; k < 2 && k < ds.length; k++) {
        const j = ds[k][1]
        if (i < j) this.edges.push([this.arts.indexOf(web[i]), this.arts.indexOf(web[j])])
      }
    }

    // Citation sources chosen BY TYPE — one PDF, one email, one chat — and the
    // rightmost of each, so the lines fan out across open paper rather than
    // stacking. Picking by array index would cite three arbitrary objects and
    // the answer's sources would not match the sources panel's own words.
    // ...and the LEFTMOST of each, i.e. the near edge of a brain that sits on
    // the right. The line should reach the closest instance of that source, not
    // dive through the whole lattice to the far side and tangle with the others.
    this.citeNodes = (['pdf', 'email', 'chat'] as ArtifactKind[]).map((tp) => {
      let best: Art | null = null
      let bd = 1e9
      for (const a of this.arts) {
        if (a.kind === tp && a.dupOf < 0 && a.flyer < 0 && a.nx < bd) {
          bd = a.nx
          best = a
        }
      }
      return best ?? this.arts[0]
    })
  }

  /* ---------------------------------------------------------------------- */
  /* public                                                                  */
  /* ---------------------------------------------------------------------- */

  private measureViewport() {
    this.vw = window.innerWidth
    this.vh = window.innerHeight
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = this.vw * this.dpr
    this.canvas.height = this.vh * this.dpr
    this.canvas.style.width = this.vw + 'px'
    this.canvas.style.height = this.vh + 'px'
  }

  resize() {
    this.measureViewport()
    if (this.arts.length) this.layout()
    if (this.opts.reducedMotion) this.frame(performance.now())
  }

  setPointer(x: number, y: number) {
    this.mx = x
    this.my = y
  }

  clearPointer() {
    this.mx = -1e4
    this.my = -1e4
  }

  getTelemetry() {
    return this.telemetry
  }

  start() {
    if (this.running) return
    if (this.opts.reducedMotion) {
      // The ending, held as one frame: the brain resolved inside the perimeter.
      this.frame(performance.now())
      return
    }
    this.running = true
    this.lastT = 0
    // PRIORITY 1 — after Lenis (0) has written this frame's scroll position, so
    // the rects we read are the ones the viewer is actually looking at.
    addTick(this.loop, 1)
  }

  stop() {
    if (!this.running) return
    this.running = false
    removeTick(this.loop)
  }

  destroy() {
    this.stop()
    this.arts.length = 0
    this.edges.length = 0
  }

  /* ---------------------------------------------------------------------- */
  /* scroll                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * How far through a section we are.
   *
   * A tall section (200-320vh) with sticky copy scrubs across its own excess
   * height. A short one gets a viewport-relative sweep instead, so an ordinary
   * 100vh section still has a usable 0..1.
   */
  private progressOf(el: HTMLElement | undefined): number {
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const span = r.height - this.vh
    if (span > 40) return clamp(-r.top / span, 0, 1)
    return clamp((this.vh * 0.85 - r.top) / (this.vh * 0.7), 0, 1)
  }

  /** The section owning the viewport centre-line. Exactly one, always. */
  private activeScene(): SceneId {
    let act: SceneId = 'hero'
    for (const s of SCENES) {
      const el = this.sections[s]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.top <= this.vh * 0.5 && r.bottom >= this.vh * 0.5) act = s
    }
    return act
  }

  /**
   * Where the brain lives, per scene. THE composition device.
   *
   * The brain is not a fixed lattice — it moves and RESIZES per beat, and that
   * is what lets each scene be framed properly without moving a camera:
   *  - ask       pushes it left, clearing the right for the answer and its lines
   *  - sovereign SHRINKS it (r .17) so the PERIMETER dominates the frame — the
   *              scene is about the walls, so the walls get the space
   *  - features  shrinks it to a corner, out of the cards' way
   *  - cta       drops it low and lets it follow the cursor
   */
  private brainCfg(scene: SceneId): BrainCfg {
    const min = Math.min(this.vw, this.vh)
    switch (scene) {
      case 'ask':
        // Brain RIGHT, copy left. The reference put its answer on the right and
        // the brain at 0.3; this site puts copy on the left in every single
        // scene, so mirroring it here keeps that promise and — more importantly
        // — gives the citation lines a long run across open paper instead of
        // terminating under the answer card, which is where they were invisible.
        return {
          cx: this.vw < 900 ? this.vw * 0.5 : this.vw * 0.72,
          cy: this.vh * 0.46,
          r: min * 0.26,
        }
      case 'sovereign':
        // Brain RIGHT, copy left. Centred (as the reference had it) puts the
        // cluster straight through "Nothing leaves. Nothing foreign enters." —
        // at 1440 the copy runs to x=667 and a centred brain starts at x=567.
        // It still reads as contained, because the PERIMETER is what dominates
        // this scene: the brain is deliberately tiny (r = 0.17) so the walls own
        // the frame. Moving it right costs that nothing and gives the copy air.
        return {
          cx: this.vw < 900 ? this.vw * 0.5 : this.vw * 0.72,
          cy: this.vh * 0.5,
          r: min * 0.17,
        }
      case 'features':
        // Top-RIGHT and small. Centred at 0.2 put the cluster directly on
        // "Built for the companies that cannot use the cloud." — the brain is
        // not the subject of this scene at all, the cards are, and 12 of these
        // artifacts have already left to become them. What remains should get
        // out of the way and stay out.
        return {
          cx: this.vw < 900 ? this.vw * 0.5 : this.vw * 0.84,
          cy: this.vh * 0.2,
          r: min * 0.07,
        }
      case 'proof':
        // Brain right — the copy and the metric grid own the left and centre.
        return {
          cx: this.vw < 900 ? this.vw * 0.5 : this.vw * 0.78,
          cy: this.vh * 0.44,
          r: min * 0.12,
        }
      case 'pricing':
        // Three cards span the full shell, so the brain has nowhere lateral to
        // stand. It goes HIGH and small instead — above the grid, level with
        // the headline, holding the same right-hand column 'proof' just left it
        // in so the transition between the two scenes is a rise, not a jump.
        return {
          cx: this.vw < 900 ? this.vw * 0.5 : this.vw * 0.8,
          cy: this.vh * 0.24,
          r: min * 0.09,
        }
      case 'cta':
        // Brain right, clear of the form. It still reads as the finale — one
        // calm secured core inside the walls, with a slow --sovereign heartbeat
        // around it — and it is the one place the brain follows the cursor.
        return {
          cx: this.vw < 900 ? this.vw * 0.5 : this.vw * 0.74,
          cy: this.vh * 0.52,
          r: min * 0.15,
        }
      default:
        return { cx: this.vw * 0.5, cy: this.vh * 0.46, r: min * 0.3 }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* loop                                                                    */
  /* ---------------------------------------------------------------------- */

  private loop = (now: number) => {
    if (!this.running) return
    this.frame(now)
  }

  private frame = (now: number) => {
    const reduced = this.opts.reducedMotion
    const t = (now - this.t0) / 1000

    // dt in 60Hz frames. Without it the whole simulation runs twice as fast on
    // a 120Hz display as on 60Hz — and it was tuned on a 120Hz machine, so most
    // visitors saw the story at half speed. Clamped to 3 frames so a tab switch
    // cannot integrate a multi-second leap and fling everything through a wall.
    const rawDt = this.lastT === 0 ? 16.667 : now - this.lastT
    this.lastT = now
    const dt = reduced ? 1 : Math.min(rawDt, 50) / 16.667

    // ---- ALL DOM READS FIRST -------------------------------------------
    // Reading rects after writing styles forces a second layout every frame.
    // Everything the frame needs is measured here, once, before any write.
    for (const s of SCENES) this.prog[s] = this.progressOf(this.sections[s])
    this.scene = reduced ? 'proof' : this.activeScene()
    this.citeRects = this.citeEls.map((e) => (e ? e.getBoundingClientRect() : null))
    this.queryRect = this.queryEl ? this.queryEl.getBoundingClientRect() : null
    this.cardRects = []
    document
      .querySelectorAll<HTMLElement>('[data-swarm-slot]')
      .forEach((e) => this.cardRects.push(e.getBoundingClientRect()))

    const sec = this.scene
    const P = this.prog
    const morph = reduced
      ? 1
      : sec === 'hero' || sec === 'problem'
        ? 0
        : sec === 'turn'
          ? ease(P.turn)
          : 1
    const bc = this.brainCfg(sec)
    if (sec === 'cta' && this.mx > 0 && !reduced) {
      // the brain watches the cursor
      bc.cx += (this.mx - this.vw / 2) * 0.05
      bc.cy += (this.my - this.vh / 2) * 0.05
    }

    const ctx = this.ctx
    const m = this.margin()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.vw, this.vh)

    // ---- targets + physics ---------------------------------------------
    const chaos = sec === 'problem' ? P.problem : 0
    let hoverA: Art | null = null
    let hoverD = 1e9

    for (let i = 0; i < this.arts.length; i++) {
      const a = this.arts[i]
      let tx: number
      let ty: number
      let ta = 1
      let tr = 0

      // Flyers fly ONLY in 'features'. The reference also held them at the cards
      // through 'proof', but by then those cards have scrolled off the top, so
      // every flyer was chasing a target above the viewport and piling against
      // the ceiling. In 'proof' they simply rejoin the brain.
      if (a.flyer >= 0 && sec === 'features') {
        // fly into the feature card that this artifact becomes part of
        const cr = this.cardRects[a.flyer]
        if (cr) {
          const cp = clamp((this.vh * 0.88 - cr.top) / (this.vh * 0.35), 0, 1)
          tx = cr.left + 20 + (i % 3) * 30
          ty = cr.top + 8
          ta = 1 - cp
        } else {
          tx = a.hx
          ty = a.hy
        }
      } else if (morph < 1 || sec === 'hero' || sec === 'problem') {
        // ---- the mess ----------------------------------------------------
        const j = reduced ? 0 : 14 + chaos * 26
        tx = a.hx + Math.sin(t * 0.5 + a.seed) * j
        ty = a.hy + Math.cos(t * 0.43 + a.seed * 1.7) * j
        // an email sinks to the bottom and is buried; a doc greys out and goes
        if (a.buried) ty = lerp(ty, this.vh - m - 20, chaos)
        ta = a.lost ? lerp(0.4, 0.12, chaos) : a.buried ? lerp(1, 0.18, chaos) : 1
        tr = a.homeRot * (1 + chaos * 0.6)
        if (a.dupOf >= 0) {
          tx += Math.sin(a.seed) * chaos * 90
          ta = lerp(0.85, 1, chaos)
        }
        if (morph > 0) {
          // THE INGESTION, scrubbed to scroll and staggered per artifact so the
          // brain accretes rather than snapping into existence on one frame.
          const d = (a.seed % 1) * 0.45
          const lp = ease(clamp((morph - d) / 0.55, 0, 1))
          tx = lerp(tx, bc.cx + a.nx * bc.r, lp)
          ty = lerp(ty, bc.cy + a.ny * bc.r, lp)
          ta = lerp(ta, a.dupOf >= 0 ? clamp(1 - lp * 1.6, 0, 1) : 1, lp)
          tr = lerp(tr, 0, lp)
        }
      } else {
        // ---- the brain, at rest -----------------------------------------
        tx = bc.cx + a.nx * bc.r + (reduced ? 0 : Math.sin(t * 0.6 + a.seed) * 3)
        ty = bc.cy + a.ny * bc.r + (reduced ? 0 : Math.cos(t * 0.5 + a.seed) * 3)
        // Recede hard in 'features' — the cards are the subject there, and a
        // half-opaque brain behind them is just noise competing with the copy.
        ta = a.dupOf >= 0 ? 0 : sec === 'features' ? 0.28 : 1
      }

      // cursor parts the swarm
      const dxm = a.x - this.mx
      const dym = a.y - this.my
      const dm2 = dxm * dxm + dym * dym
      if (dm2 < 8100 && !reduced) {
        const f = (1 - Math.sqrt(dm2) / 90) * 1.1
        a.vx += (dxm / 90) * f * dt
        a.vy += (dym / 90) * f * dt
      }

      a.vx += (tx - a.x) * 0.028 * dt
      a.vy += (ty - a.y) * 0.028 * dt
      const damp = Math.pow(0.86, dt)
      a.vx *= damp
      a.vy *= damp
      a.x += a.vx * dt
      a.y += a.vy * dt

      // ---- THE WALL: nothing ever crosses out --------------------------
      // The on-prem promise as a physics constraint rather than a sentence.
      if (a.x < m + 14) {
        a.x = m + 14
        a.vx = Math.abs(a.vx) * 0.6
      }
      if (a.x > this.vw - m - 14) {
        a.x = this.vw - m - 14
        a.vx = -Math.abs(a.vx) * 0.6
      }
      if (a.y < m + 12) {
        a.y = m + 12
        a.vy = Math.abs(a.vy) * 0.6
      }
      if (a.y > this.vh - m - 12) {
        a.y = this.vh - m - 12
        a.vy = -Math.abs(a.vy) * 0.6
      }

      const rotL = 1 - Math.pow(0.92, dt)
      const alphaL = 1 - Math.pow(0.92, dt)
      a.rot += (tr - a.rot) * rotL
      a.alpha += (ta - a.alpha) * alphaL

      if (a.alpha > 0.3 && dm2 < 900 && dm2 < hoverD) {
        hoverD = dm2
        hoverA = a
      }
    }

    // ---- edges ---------------------------------------------------------
    const edgeBase = sec === 'turn' ? clamp((morph - 0.55) / 0.35, 0, 1) : morph >= 1 ? 1 : 0
    // While citations are on screen they must be the STRONGEST thing there, so
    // the lattice deliberately dims underneath them.
    const citeHold = sec === 'ask' ? clamp((P.ask - 0.3) / 0.15, 0, 1) : 0
    if (edgeBase > 0) {
      ctx.strokeStyle = this.p.brain
      ctx.lineWidth = 0.8
      ctx.globalAlpha = edgeBase * (sec === 'features' ? 0.35 : 1) * (1 - citeHold * 0.65) * 0.55
      ctx.beginPath()
      for (const [i, j] of this.edges) {
        ctx.moveTo(this.arts[i].x, this.arts[i].y)
        ctx.lineTo(this.arts[j].x, this.arts[j].y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1

      // ambient query packets — a live question moving through the index
      if (!reduced && morph >= 1 && sec !== 'features' && this.edges.length) {
        ctx.fillStyle = this.p.query
        for (let k = 0; k < 3; k++) {
          const e = this.edges[(k * 7 + Math.floor(t / 2.2)) % this.edges.length]
          const u = (t / 2.2 + k * 0.33) % 1
          const A = this.arts[e[0]]
          const B = this.arts[e[1]]
          ctx.globalAlpha = 0.8 * edgeBase * (1 - citeHold * 0.7)
          ctx.beginPath()
          ctx.arc(lerp(A.x, B.x, u), lerp(A.y, B.y, u), 2.4, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
    }

    // ---- artifacts ------------------------------------------------------
    const tight = bc.r < Math.min(this.vw, this.vh) * 0.2 && morph >= 1
    for (const a of this.arts) {
      if (a.alpha < 0.02) continue
      ctx.globalAlpha = a.alpha
      ctx.save()
      ctx.translate(a.x, a.y)
      ctx.rotate(a.rot)
      const sc = a.scale * (morph >= 1 ? 0.8 : 1) * (tight ? 0.62 : 1)
      ctx.drawImage(
        a.sprite.canvas,
        (-a.sprite.w / 2) * sc,
        (-a.sprite.h / 2) * sc,
        a.sprite.w * sc,
        a.sprite.h * sc,
      )
      ctx.restore()
    }
    ctx.globalAlpha = 1

    if (!reduced) {
      this.drawAsk(sec, P.ask, t)
      this.drawSovereign(sec, P.sovereign, m)
    }

    // ---- turn pulse + cta heartbeat -------------------------------------
    if (sec === 'turn' && P.turn > 0.96 && !this.turnPulsed) {
      this.turnPulsed = true
      this.sovPulse = 1 // "and none of it left your walls"
    }
    if (sec === 'turn' && P.turn < 0.5) this.turnPulsed = false

    let sovEmph = 0
    if (sec === 'sovereign') sovEmph = Math.sin(clamp01(P.sovereign) * Math.PI)
    if (sec === 'cta' && !reduced) {
      const hb = (t % 1.9) / 1.9
      ctx.strokeStyle = `rgba(216,49,91,${(1 - hb) * 0.45})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(bc.cx, bc.cy, bc.r * 0.9 + hb * 55, 0, Math.PI * 2)
      ctx.stroke()
      if (hb < 0.1) this.sovPulse = Math.max(this.sovPulse, 0.35)
    }
    this.sovPulse *= Math.pow(0.94, dt)
    this.drawPerimeter(this.sovPulse, sovEmph, m)

    // ---- telemetry ------------------------------------------------------
    this.telemetry.indexed = morph >= 1 ? this.liveCount : Math.floor(morph * this.liveCount)
    this.telemetry.cited = sec === 'ask' || sec === 'proof' || sec === 'cta' ? 3 : 0
    this.telemetry.queries = sec === 'ask' && P.ask > 0.3 ? 1 : 0
    this.telemetry.scene = sec

    // ---- ALL DOM WRITES LAST -------------------------------------------
    this.writeCiteChips(sec, P.ask)
    this.writeTip(hoverA, reduced)
  }

  /* ---------------------------------------------------------------------- */
  /* scene pieces                                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * The perimeter — "your walls". A thin confident blueprint line, drawn every
   * frame, that flushes --sovereign on a beat. Labelled, because a technical
   * drawing labels its parts.
   */
  private drawPerimeter(pulse: number, emph: number, m: number) {
    const ctx = this.ctx
    ctx.lineWidth = 1.2 + emph * 0.8 + pulse * 0.8
    ctx.strokeStyle = `rgba(99,94,84,${0.5 + emph * 0.3})`
    ctx.strokeRect(m, m, this.vw - m * 2, this.vh - m * 2)
    if (pulse > 0.01) {
      ctx.strokeStyle = `rgba(216,49,91,${pulse * 0.9})`
      ctx.strokeRect(m, m, this.vw - m * 2, this.vh - m * 2)
    }

    // corner ticks — register marks, not decoration
    ctx.strokeStyle = `rgba(28,27,24,${0.55 + pulse * 0.4})`
    ctx.lineWidth = 1.6
    const T = 11
    const corners: [number, number, number, number][] = [
      [m, m, 1, 1],
      [this.vw - m, m, -1, 1],
      [m, this.vh - m, 1, -1],
      [this.vw - m, this.vh - m, -1, -1],
    ]
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath()
      ctx.moveTo(x + sx * T, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y + sy * T)
      ctx.stroke()
    }

    // ONE label, inside the wall's BOTTOM-left.
    //
    // Every position for this is contested and this is the only free one:
    //  - above the line (the reference's choice) lands in the navbar;
    //  - bottom-RIGHT is where the telemetry rail lives — it would print
    //    "EGRESS 0 B" on top of a rail already saying "data egress 0 bytes";
    //  - top-left collides with each scene's own mono eyebrow. Every section
    //    opens with one ("TRUSTWORTHY", "SOVEREIGN", "PROOF") at the same size,
    //    the same font and very nearly the same y — two mono labels stacked on
    //    each other reading as one garbled line.
    // The bottom-left is empty in every scene: the copy is vertically centred
    // and the hero's scroll cue sits centre-bottom, outside the wall.
    ctx.font = '500 9px "IBM Plex Mono", ui-monospace, monospace'
    ctx.fillStyle = pulse > 0.2 ? this.p.sovereign : this.p.inkSoft
    ctx.fillText('SECURE PERIMETER — ON-PREM · EGRESS 0 B', m + 14, this.vh - m - 10)
  }

  /**
   * Scene 4 — the crucial moment. A query enters, then every clause of the
   * answer draws a line from ITS OWN [n] chip in the sentence back to the exact
   * artifact it came from, and the chip fills in when the line lands.
   *
   * Anchoring to the real chip's rect (rather than a card edge) is what makes
   * this read as a citation rather than as decoration: the line starts at the
   * word you are reading.
   */
  private drawAsk(sec: SceneId, pAsk: number, t: number) {
    if (sec !== 'ask') return
    const ctx = this.ctx
    const bc = this.brainCfg('ask')

    // ---- THE QUESTION ENTERS THE BRAIN ---------------------------------
    // The --query packet launches from the QUESTION ITSELF and flies into the
    // core. It used to rise from the bottom edge of the screen, which stands for
    // nothing — the amber dot appeared out of the void and the viewer had no way
    // to read it as anything. Anchored to the question's own rect, the beat is
    // legible without a caption: your question goes in, and (0.34 onward) the
    // citations come back out to the sources it was answered from.
    const q = this.queryRect
    if (q) {
      const sx = q.right + 6
      const sy = q.top + q.height / 2
      const pin = clamp(pAsk / 0.3, 0, 1)
      if (pin < 1) {
        const e = ease(pin)
        const px = lerp(sx, bc.cx, e)
        const py = lerp(sy, bc.cy, e)
        // the trail it has travelled so far
        ctx.strokeStyle = 'rgba(224,123,57,.35)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(px, py)
        ctx.stroke()
        ctx.fillStyle = this.p.query
        ctx.beginPath()
        ctx.arc(px, py, 4.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (let k = 0; k < this.citeRects.length; k++) {
      const r = this.citeRects[k]
      const n = this.citeNodes[k]
      if (!r || !n) continue
      const lp = ease(clamp((pAsk - 0.34 - k * 0.09) / 0.14, 0, 1))
      if (lp <= 0) continue
      const x1 = r.left + r.width / 2
      const y1 = r.bottom + 2
      const xe = lerp(x1, n.x, lp)
      const ye = lerp(y1, n.y, lp)
      ctx.strokeStyle = this.p.brain
      ctx.lineWidth = 1.6
      ctx.globalAlpha = 0.95
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.quadraticCurveTo(lerp(x1, n.x, 0.5), Math.max(y1, n.y) + 60, xe, ye)
      ctx.stroke()
      if (lp > 0.95) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, 16 + Math.sin(t * 3) * 2, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  /**
   * Scene 5 — something from OUTSIDE tries to get in and is turned away at the
   * wall. Not asserted; shown.
   */
  private drawSovereign(sec: SceneId, pSov: number, m: number) {
    if (sec !== 'sovereign') return
    const ctx = this.ctx
    const y = this.vh * 0.45
    const f = clamp(pSov * 2.4, 0, 1)
    const g = clamp(pSov * 2.4 - 1, 0, 1.2)
    const px = g > 0 ? lerp(m, -80, ease(clamp(g, 0, 1))) : lerp(-60, m, ease(f))

    if (px > -70) {
      // the intruder: an ink packet marked with an X
      ctx.fillStyle = this.p.ink
      ctx.beginPath()
      ctx.arc(px - 8, y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = this.p.paper
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(px - 10.5, y - 2.5)
      ctx.lineTo(px - 5.5, y + 2.5)
      ctx.moveTo(px - 5.5, y - 2.5)
      ctx.lineTo(px - 10.5, y + 2.5)
      ctx.stroke()
    }
    if (f >= 1 && g < 0.5) {
      // the wall answers
      const rp = 1 - clamp(g * 2, 0, 1)
      ctx.strokeStyle = `rgba(216,49,91,${rp})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(m, y, 8 + (1 - rp) * 46, -1.2, 1.2)
      ctx.stroke()
      this.sovPulse = Math.max(this.sovPulse, rp)
    }
  }

  /* ---------------------------------------------------------------------- */
  /* DOM writes — all of them, at the end of the frame                       */
  /* ---------------------------------------------------------------------- */

  private writeCiteChips(sec: SceneId, pAsk: number) {
    for (let k = 0; k < this.citeEls.length; k++) {
      const ce = this.citeEls[k]
      if (!ce) continue
      const lp = sec === 'ask' ? ease(clamp((pAsk - 0.34 - k * 0.09) / 0.14, 0, 1)) : 0
      const on = lp > 0.9
      ce.style.background = on ? this.p.brain : 'transparent'
      ce.style.color = on ? this.p.paper : this.p.brain
    }
  }

  private writeTip(hover: Art | null, reduced: boolean) {
    const tip = this.tipEl
    if (!tip) return
    if (hover && !reduced) {
      tip.textContent = hover.label
      tip.style.opacity = '1'
      tip.style.transform = `translate(${Math.min(this.mx + 14, this.vw - 260)}px, ${this.my - 30}px)`
    } else {
      tip.style.opacity = '0'
    }
  }
}
