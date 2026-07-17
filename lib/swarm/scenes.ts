import type { Artifact, SceneId, Slot } from './types'

/**
 * ============================================================================
 * THE SCREENPLAY — scroll position in, target positions out.
 * ============================================================================
 * This module is pure geometry and holds no state. The engine asks "given this
 * scene at this progress, where does every artifact want to be?" and integrates
 * toward the answer. Keeping the choreography separate from the physics is what
 * makes the scenes tunable without touching the simulation.
 *
 * The narrative arc encoded here:
 *   hero      scattered, tilted, disconnected — a mess on a desk
 *   problem   the mess gets WORSE: duplicates multiply, things sink and grey out
 *   turn      everything flows inward and resolves into one lattice   <- money shot
 *   ask       the lattice holds; a question moves through it
 *   sovereign the lattice holds; the wall does its job
 *   features  artifacts redistribute into the UI of the next section
 *   proof     calm
 *   cta       converge into one secured core
 */

export interface Geometry {
  /** The drawn perimeter — "your walls". Nothing ever crosses it. */
  wall: { x: number; y: number; w: number; h: number }
  /** Resolved lattice node positions, [x0,y0, x1,y1, ...]. */
  nodes: Float32Array
  /** Node index pairs forming filament edges. */
  edges: Uint16Array
  cx: number
  cy: number
}

/** Per-scene physics blend. */
export interface Field {
  /** Weight of boids (separation/alignment/cohesion). */
  chaos: number
  /**
   * Weight of the spring toward the target. PHYSICS ONLY.
   *
   * Do NOT read this as "how organized the brain is". In the hero the target is
   * each artifact's own SCATTERED home, so `order` is high there simply to stop
   * boids balling everything into a clump — it says nothing about indexing.
   * Conflating the two drew lattice edges across the chaotic hero and made the
   * telemetry claim 15/58 artifacts were indexed before ingestion had begun.
   */
  order: number
  /**
   * 0..1 — the NARRATIVE state: how much of the brain actually exists yet.
   * Drives the filament edges and the telemetry's indexed count. This is the
   * story; `order` is just the maths that moves things around.
   */
  organized: number
  /** Spring stiffness. */
  k: number
  /** Velocity damping. */
  damp: number
  /** How strongly the swarm leans toward the cursor. */
  lean: number
}

export function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** Smoothstep — the difference between "moves" and "moves nicely". */
const ease = (t: number) => t * t * (3 - 2 * t)

/* -------------------------------------------------------------------------- */
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The resolved brain. Phyllotaxis (golden-angle) placement, squashed into an
 * ellipse — organized and even, but organic rather than a grid. A grid would
 * read as a spreadsheet; this reads as a mind.
 */
export function buildGeometry(w: number, h: number, count: number): Geometry {
  const inset = Math.min(Math.max(w * 0.05, 20), 72)
  const wall = { x: inset, y: inset, w: w - inset * 2, h: h - inset * 2 }
  const cx = w / 2
  const cy = h / 2

  const nodes = new Float32Array(count * 2)
  const radius = Math.min(wall.w * 0.34, wall.h * 0.42)
  const GOLDEN = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 0.5) / count) * radius
    const theta = i * GOLDEN
    nodes[i * 2] = cx + Math.cos(theta) * r * 1.35
    nodes[i * 2 + 1] = cy + Math.sin(theta) * r * 0.92
  }

  // Connect each node to its nearest neighbours. O(n^2) at init only — with
  // n<=70 that is ~5k distance checks, once, on resize. Never per frame.
  const edges: number[] = []
  const NEIGHBOURS = 2
  for (let i = 0; i < count; i++) {
    const best: { j: number; d: number }[] = []
    for (let j = 0; j < count; j++) {
      if (i === j) continue
      const dx = nodes[i * 2] - nodes[j * 2]
      const dy = nodes[i * 2 + 1] - nodes[j * 2 + 1]
      const d = dx * dx + dy * dy
      best.push({ j, d })
    }
    best.sort((a, b) => a.d - b.d)
    for (let n = 0; n < NEIGHBOURS && n < best.length; n++) {
      const j = best[n].j
      // dedupe: only store each undirected edge once
      if (i < j) edges.push(i, j)
      else if (!best.slice(0, NEIGHBOURS).some(() => false)) edges.push(j, i)
    }
  }

  // unique-ify
  const seen = new Set<number>()
  const uniq: number[] = []
  for (let i = 0; i < edges.length; i += 2) {
    const key = edges[i] * 4096 + edges[i + 1]
    if (seen.has(key)) continue
    seen.add(key)
    uniq.push(edges[i], edges[i + 1])
  }

  return { wall, nodes, edges: Uint16Array.from(uniq), cx, cy }
}

/* -------------------------------------------------------------------------- */
/* fields                                                                      */
/* -------------------------------------------------------------------------- */

export function fieldFor(scene: SceneId, p: number): Field {
  switch (scene) {
    // `order` here pulls toward each artifact's own scattered HOME, not toward
    // the lattice — it is what keeps the mess spread across the whole wall.
    // Too low and boids cohesion balls everything into clumps with dead space
    // around them, which reads as a rendering bug rather than as chaos.
    // Nothing is indexed yet, so `organized` is 0 — no filaments, no count.
    case 'hero':
      return { chaos: 1, order: 0.26, organized: 0, k: 0.007, damp: 0.982, lean: 0.35 }
    case 'problem':
      // The mess gets worse as you scroll — but it must stay DISTRIBUTED mess.
      return {
        chaos: 1 + p * 0.5,
        order: 0.2 * (1 - p * 0.5),
        organized: 0,
        k: 0.006,
        damp: 0.987,
        lean: 0.2,
      }
    case 'turn': {
      // THE MONEY SHOT. Chaos surrenders to order, scrubbed to scroll, so the
      // visitor feels that THEY caused the organization. This is the only scene
      // where `organized` moves — the brain is being built, right now, by them.
      const t = ease(clamp01(p))
      return {
        chaos: 1 - t * 0.98,
        order: t,
        organized: t,
        k: lerp(0.006, 0.09, t),
        damp: lerp(0.985, 0.86, t),
        lean: 0.1,
      }
    }
    case 'ask':
      return { chaos: 0.02, order: 1, organized: 1, k: 0.09, damp: 0.86, lean: 0.14 }
    case 'sovereign':
      return { chaos: 0.06, order: 1, organized: 1, k: 0.07, damp: 0.88, lean: 0.1 }
    case 'features':
      return { chaos: 0.02, order: 1, organized: 1, k: 0.075, damp: 0.87, lean: 0.08 }
    case 'proof':
      return { chaos: 0.03, order: 1, organized: 1, k: 0.08, damp: 0.88, lean: 0.1 }
    case 'cta':
      // Everything gathers. The brain watches the cursor.
      return { chaos: 0.02, order: 1, organized: 1, k: 0.06, damp: 0.9, lean: 0.5 }
  }
}

/* -------------------------------------------------------------------------- */
/* targets                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Write each artifact's target in place. Called once per frame.
 * MUST NOT allocate: no object literals, no array methods that build arrays.
 */
export function resolveTargets(
  arts: Artifact[],
  scene: SceneId,
  p: number,
  geo: Geometry,
  slots: Slot[],
  time: number,
) {
  const { wall, nodes, cx, cy } = geo
  const n = arts.length

  for (let i = 0; i < n; i++) {
    const a = arts[i]
    const s = a.seed

    switch (scene) {
      case 'hero':
      case 'problem': {
        // A loose home anchor per artifact, drifting on a slow deterministic
        // orbit. Anchors stop boids collapsing into one clump while keeping the
        // scatter alive rather than frozen.
        // X and Y use INDEPENDENT seeds — deriving one from the other bands the
        // whole swarm onto diagonal lines. See Artifact.seedB.
        const homeX = wall.x + (0.06 + s * 0.88) * wall.w
        const homeY = wall.y + (0.06 + a.seedB * 0.88) * wall.h
        const drift = scene === 'problem' ? 1 + p * 1.4 : 1
        a.tx = homeX + Math.sin(time * 0.00016 + s * 31.4) * 34 * drift
        a.ty = homeY + Math.cos(time * 0.00013 + s * 17.7) * 28 * drift

        // Scattered means TILTED. Nothing is square with anything.
        a.trot = (s - 0.5) * 0.85

        if (scene === 'problem') {
          // An email sinks and gets buried; a doc greys out and vanishes.
          if (a.lost) {
            a.ty += p * 150
            a.opacity = lerp(1, 0.16, ease(clamp01(p * 1.3)))
          }
          // Duplicates multiply — they fade IN as the problem worsens.
          if (a.dupOf >= 0) {
            a.opacity = lerp(0, 0.85, ease(clamp01(p * 1.6)))
            a.tx = arts[a.dupOf].x + (s - 0.5) * 46
            a.ty = arts[a.dupOf].y + (a.seedB - 0.5) * 34
            a.trot = (s - 0.5) * 1.2
          }
        } else {
          // hero: duplicates already present but subtle; nothing lost yet.
          if (a.dupOf >= 0) a.opacity = 0.5
          else if (a.lost) a.opacity = 0.42
          else a.opacity = 1
        }
        break
      }

      case 'turn': {
        const t = ease(clamp01(p))

        if (a.dupOf >= 0) {
          // Duplicates merge into their original and disappear. Four versions
          // of the same document become one.
          const o = arts[a.dupOf]
          a.tx = lerp(a.tx, o.x, t)
          a.ty = lerp(a.ty, o.y, t)
          a.merge = t
          a.opacity = lerp(0.85, 0, ease(clamp01(p * 1.5)))
          a.trot = lerp(a.trot, o.trot, t)
        } else {
          // Everything else flows inward and takes its place in the lattice.
          const ni = a.node
          a.tx = nodes[ni * 2]
          a.ty = nodes[ni * 2 + 1]
          // Straighten up. Order looks like alignment.
          a.trot = lerp((s - 0.5) * 0.85, 0, t)
          // The lost are RECOVERED — this is the promise, shown not told.
          a.opacity = a.lost ? lerp(0.16, 1, ease(clamp01((p - 0.25) * 1.8))) : 1
        }
        break
      }

      case 'ask':
      case 'proof': {
        if (a.dupOf >= 0) {
          a.opacity = 0
          break
        }
        const ni = a.node
        // A living index breathes. Barely.
        a.tx = nodes[ni * 2] + Math.sin(time * 0.0004 + s * 12.9) * 2.4
        a.ty = nodes[ni * 2 + 1] + Math.cos(time * 0.0005 + s * 8.3) * 2.4
        a.trot = 0
        a.opacity = 1
        break
      }

      case 'sovereign': {
        if (a.dupOf >= 0) {
          a.opacity = 0
          break
        }
        const ni = a.node
        // Internal data drifts toward the wall and bounces back — nothing exits.
        // Push outward from centre, on a slow cycle.
        const pushT = Math.sin(time * 0.0006 + s * 5.1)
        const dx = nodes[ni * 2] - cx
        const dy = nodes[ni * 2 + 1] - cy
        const push = 0.16 * Math.max(0, pushT) * ease(clamp01(p * 2))
        a.tx = nodes[ni * 2] + dx * push
        a.ty = nodes[ni * 2 + 1] + dy * push
        a.trot = 0
        a.opacity = 1
        break
      }

      case 'features': {
        if (a.dupOf >= 0) {
          a.opacity = 0
          break
        }
        if (slots.length === 0) {
          const ni = a.node
          a.tx = nodes[ni * 2]
          a.ty = nodes[ni * 2 + 1]
          a.opacity = 1
          break
        }
        // Artifacts redistribute into the UI of the next section: they fly to
        // the outline of the feature cards and become their substance.
        const slot = slots[i % slots.length]
        const per = Math.max(1, Math.ceil(n / slots.length))
        const k = Math.floor(i / slots.length) % per
        const around = (k + 0.5) / per
        // walk the card's perimeter
        const peri = 2 * (slot.w + slot.h)
        let d = around * peri
        let px: number, py: number
        if (d < slot.w) {
          px = slot.x + d
          py = slot.y
        } else if ((d -= slot.w) < slot.h) {
          px = slot.x + slot.w
          py = slot.y + d
        } else if ((d -= slot.h) < slot.w) {
          px = slot.x + slot.w - d
          py = slot.y + slot.h
        } else {
          d -= slot.w
          px = slot.x
          py = slot.y + slot.h - d
        }
        a.tx = px
        a.ty = py
        a.trot = 0
        a.opacity = 0.9
        break
      }

      case 'cta': {
        if (a.dupOf >= 0) {
          a.opacity = 0
          break
        }
        // One calm, secured core. Everything converges.
        const ni = a.node
        const ang = ni * 2.399963
        const r = Math.sqrt((ni + 0.5) / n) * Math.min(wall.w * 0.15, wall.h * 0.3)
        a.tx = cx + Math.cos(ang + time * 0.00006) * r * 1.2
        a.ty = cy + Math.sin(ang + time * 0.00006) * r * 0.85
        a.trot = 0
        a.opacity = 1
        break
      }
    }
  }
}

/**
 * The static composition used under prefers-reduced-motion: the resolved brain,
 * inside the perimeter, at rest. Not a blank box — the ending of the story,
 * told in one frame.
 */
export function resolveStatic(arts: Artifact[], geo: Geometry) {
  for (let i = 0; i < arts.length; i++) {
    const a = arts[i]
    if (a.dupOf >= 0) {
      a.opacity = 0
      continue
    }
    a.x = a.tx = geo.nodes[a.node * 2]
    a.y = a.ty = geo.nodes[a.node * 2 + 1]
    a.vx = 0
    a.vy = 0
    a.rot = 0
    a.trot = 0
    a.opacity = 1
  }
}
