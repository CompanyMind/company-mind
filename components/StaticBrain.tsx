import { cn } from '@/lib/cn'

/**
 * The calm, resolved version of the homepage swarm — a perimeter with an
 * organized lattice inside it, at rest.
 *
 * Secondary pages echo the motif but do NOT run the scroll engine: a marketing
 * subpage does not deserve a 60fps physics simulation. This is pure SVG, no
 * JS, no canvas, no rAF — it costs nothing and it says the same thing.
 *
 * It is also exactly the composition the canvas freezes into under
 * prefers-reduced-motion, so the two never contradict each other.
 */

// Deterministic lattice. Hand-placed rather than random so it reads as
// *organized* — a random graph would undercut the entire point.
const NODES = [
  { x: 50, y: 22 },
  { x: 26, y: 40 },
  { x: 74, y: 40 },
  { x: 38, y: 62 },
  { x: 62, y: 62 },
  { x: 50, y: 44 },
  { x: 16, y: 66 },
  { x: 84, y: 66 },
  { x: 50, y: 80 },
]

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 5],
  [1, 3],
  [2, 4],
  [5, 3],
  [5, 4],
  [3, 4],
  [1, 6],
  [2, 7],
  [3, 8],
  [4, 8],
  [6, 3],
  [7, 4],
]

export function StaticBrain({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('h-full w-full', className)}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* your walls — the constant that frames everything */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="2"
        fill="none"
        stroke="var(--line)"
        strokeWidth="0.5"
      />
      {/* blueprint register marks at the corners */}
      {[
        [4, 4],
        [96, 4],
        [4, 96],
        [96, 96],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} stroke="var(--ink-soft)" strokeWidth="0.5" opacity="0.5">
          <line x1={x - 2} y1={y} x2={x + 2} y2={y} />
          <line x1={x} y1={y - 2} x2={x} y2={y + 2} />
        </g>
      ))}

      {/* filament edges — thin, quiet, connective */}
      <g stroke="var(--brain)" strokeWidth="0.35" opacity="0.4">
        {EDGES.map(([a, b], i) => (
          <line key={i} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} />
        ))}
      </g>

      {/* the artifacts, indexed and at rest */}
      <g>
        {NODES.map((n, i) => (
          <g key={i}>
            <rect
              x={n.x - 3.2}
              y={n.y - 2.4}
              width="6.4"
              height="4.8"
              rx="1"
              fill="var(--paper-raised)"
              stroke="var(--brain)"
              strokeWidth="0.4"
            />
            <line
              x1={n.x - 1.8}
              y1={n.y - 0.6}
              x2={n.x + 1.8}
              y2={n.y - 0.6}
              stroke="var(--ink-soft)"
              strokeWidth="0.3"
              opacity="0.55"
            />
            <line
              x1={n.x - 1.8}
              y1={n.y + 0.8}
              x2={n.x + 0.6}
              y2={n.y + 0.8}
              stroke="var(--ink-soft)"
              strokeWidth="0.3"
              opacity="0.35"
            />
          </g>
        ))}
      </g>
    </svg>
  )
}
