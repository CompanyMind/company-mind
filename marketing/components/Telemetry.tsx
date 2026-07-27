'use client'

import { useEffect, useRef, useState } from 'react'
import type { Telemetry as TelemetryState } from '@/lib/swarm/types'
import type { TelemetryCopy } from '@/content/types'
import { cn } from '@/lib/cn'

/**
 * The live system readout — an inset paper rail pinned to the screen edge.
 *
 * Every value here is REAL engine state (artifacts actually indexed, sources
 * actually cited, the scene actually playing), not decoration. That is the
 * point: the site's own instrumentation behaves the way the product claims to.
 *
 * `data egress: 0 bytes` is not a boast and not a counter that happens to sit
 * at zero — there is no outbound path for it to measure. It is a constant.
 *
 * POSITION: bottom-right, not the left edge. A vertical left rail is ~185px
 * wide and the content shell is 82rem — at 1440px they overlap by design, and
 * the rail landed on top of the hero headline. Reserving a left margin would
 * shove every page off-centre. The bottom-right corner is where most scenes
 * have nothing (features runs five cards in a three-column grid, so its last
 * cell is empty), so the readout can usually live at a true screen edge
 * without fighting the copy it narrates.
 *
 * WHERE IT CANNOT: a scene marks itself `data-hides-telemetry` and the rail
 * fades out while that scene is on screen. Pricing does — three cards fill the
 * row, the third one reaches the corner, and the rail was sitting on its
 * feature list. Opt-in on the section rather than a scene name hard-coded in
 * here: the HUD should not have to know the screenplay.
 *
 * Hidden below lg: on a phone this would cover the story it is narrating.
 */

export function Telemetry({ state, copy }: { state: TelemetryState | null; copy: TelemetryCopy }) {
  const indexed = state?.indexed ?? 0
  const total = state?.total ?? 0
  const cited = state?.cited ?? 0
  const queries = state?.queries ?? 0
  const scene = state?.scene ?? 'hero'

  // Retire the rail over anything it would land on: the footer, whose own
  // "data egress: 0 bytes" line sits in exactly this corner, and any section
  // that opted out with `data-hides-telemetry`.
  //
  // A SET of what is currently on screen, not a counter. Two observed elements
  // can be visible at once (a tall scene, then the footer), so a boolean would
  // let the first one's exit switch the rail back on underneath the second.
  //
  // And not a counter either: IntersectionObserver fires an initial callback
  // for EVERY observed target, including the ones that are not intersecting, so
  // a +1/-1 tally starts at minus-the-number-of-offscreen-targets and the rail
  // stays visible over the first section that should have hidden it. Membership
  // is idempotent; arithmetic on entry events is not.
  const sentinel = useRef<HTMLDivElement>(null)
  const [obstructed, setObstructed] = useState(false)

  useEffect(() => {
    const targets = [
      ...document.querySelectorAll('footer'),
      ...document.querySelectorAll('[data-hides-telemetry]'),
    ]
    if (!targets.length) return

    const visible = new Set<Element>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target)
          else visible.delete(entry.target)
        }
        setObstructed(visible.size > 0)
      },
      { threshold: 0 },
    )
    for (const target of targets) io.observe(target)
    return () => io.disconnect()
  }, [])

  return (
    <aside
      ref={sentinel}
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed bottom-0 right-0 z-20 hidden transition-opacity duration-500 ease-paper lg:block',
        obstructed ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="bg-paper-sunk/85 rounded-tl-sm border-l border-t border-line px-4 py-3 backdrop-blur-sm">
        <ul className="flex flex-col gap-2 font-mono text-telemetry text-ink-soft">
          <Row label={copy.artifacts} value={`${indexed}/${total}`} />
          <Row label={copy.sourcesCited} value={String(cited)} />
          <Row label={copy.queries} value={String(queries)} />
          <li className="my-0.5 h-px bg-line" />
          {/* The one line that is always true, everywhere on the site. */}
          <li className="flex items-center justify-between gap-8">
            <span>{copy.dataEgress}</span>
            <span className="flex items-center gap-1.5 text-ink">
              <span className="inline-block h-1 w-1 rounded-full bg-brain" />
              {copy.egressValue}
            </span>
          </li>
          <li className="my-0.5 h-px bg-line" />
          <Row label={copy.state} value={copy.scenes[scene] ?? scene} />
        </ul>
      </div>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-8">
      <span>{label}</span>
      {/* tabular-nums stops the rail twitching as digits change width */}
      <span className="tabular-nums text-ink">{value}</span>
    </li>
  )
}
