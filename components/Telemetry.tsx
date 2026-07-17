'use client'

import { useEffect, useRef, useState } from 'react'
import type { Telemetry as TelemetryState } from '@/lib/swarm/types'
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
 * shove every page off-centre. The bottom-right corner is the one region no
 * scene occupies, so the readout can live at a true screen edge without ever
 * fighting the copy it narrates.
 *
 * Hidden below lg: on a phone this would cover the story it is narrating.
 */

const SCENE_LABEL: Record<string, string> = {
  hero: 'scattered',
  problem: 'unindexed',
  turn: 'ingesting',
  ask: 'answering',
  sovereign: 'sealed',
  features: 'assembling',
  proof: 'at rest',
  cta: 'secured',
}

export function Telemetry({ state }: { state: TelemetryState | null }) {
  const indexed = state?.indexed ?? 0
  const total = state?.total ?? 0
  const cited = state?.cited ?? 0
  const queries = state?.queries ?? 0
  const scene = state?.scene ?? 'hero'

  // Retire the rail once the footer arrives. It is a HUD for the scroll story,
  // and the story is over by then — worse, it sits in the same bottom-right
  // corner as the footer's own "data egress: 0 bytes" line and lands directly
  // on top of it.
  const sentinel = useRef<HTMLDivElement>(null)
  const [atFooter, setAtFooter] = useState(false)

  useEffect(() => {
    const footer = document.querySelector('footer')
    if (!footer) return
    const io = new IntersectionObserver((entries) => setAtFooter(!!entries[0]?.isIntersecting), {
      threshold: 0,
    })
    io.observe(footer)
    return () => io.disconnect()
  }, [])

  return (
    <aside
      ref={sentinel}
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed bottom-0 right-0 z-20 hidden transition-opacity duration-500 ease-paper lg:block',
        atFooter ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div className="bg-paper-sunk/85 rounded-tl-sm border-l border-t border-line px-4 py-3 backdrop-blur-sm">
        <ul className="flex flex-col gap-2 font-mono text-telemetry text-ink-soft">
          <Row label="artifacts" value={`${indexed}/${total}`} />
          <Row label="sources cited" value={String(cited)} />
          <Row label="queries" value={String(queries)} />
          <li className="my-0.5 h-px bg-line" />
          {/* The one line that is always true, everywhere on the site. */}
          <li className="flex items-center justify-between gap-8">
            <span>data egress</span>
            <span className="flex items-center gap-1.5 text-ink">
              <span className="inline-block h-1 w-1 rounded-full bg-brain" />0 bytes
            </span>
          </li>
          <li className="my-0.5 h-px bg-line" />
          <Row label="state" value={SCENE_LABEL[scene] ?? scene} />
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
