/**
 * ONE requestAnimationFrame loop for the whole page, with explicit ordering.
 *
 * WHY THIS EXISTS. Lenis and the swarm engine each ran their own rAF. Two loops
 * means two callbacks per frame in whatever order the browser happens to hold
 * them — and React runs child effects BEFORE parent ones, so SwarmCanvas
 * (a child of the page) reliably registered before SmoothScroll (in the layout).
 * The engine therefore read every section's rect BEFORE Lenis had written that
 * frame's scroll position, so the swarm was permanently one frame stale against
 * the page. That is what reads as jank: the copy moves, the canvas answers late,
 * every frame.
 *
 * GSAP's ticker prevented this for free (`gsap.ticker.add(lenis.raf)` and
 * everything else downstream of it). Removing GSAP removed the guarantee, so
 * this restores it in 20 lines: one loop, priority-ordered, scroll first.
 *
 *   priority 0 — Lenis writes the scroll position
 *   priority 1 — the engine reads it and draws
 *
 * Never register anything that writes scroll at priority > 0.
 */

type Entry = { fn: (t: number) => void; p: number }

const entries: Entry[] = []
let raf = 0

function loop(t: number) {
  // Iterate a copy: a callback may remove itself (engine.stop on visibilitychange).
  for (let i = 0; i < entries.length; i++) entries[i].fn(t)
  raf = requestAnimationFrame(loop)
}

/** Register a per-frame callback. Lower priority runs first. */
export function addTick(fn: (t: number) => void, p = 0) {
  entries.push({ fn, p })
  entries.sort((a, b) => a.p - b.p)
  if (!raf) raf = requestAnimationFrame(loop)
}

export function removeTick(fn: (t: number) => void) {
  const i = entries.findIndex((e) => e.fn === fn)
  if (i >= 0) entries.splice(i, 1)
  if (!entries.length && raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}
