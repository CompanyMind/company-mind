'use client'

import { useCallback, useState } from 'react'
import { SwarmCanvas } from '@/components/SwarmCanvas'
import { Telemetry } from '@/components/Telemetry'
import type { Telemetry as TelemetryState } from '@/lib/swarm/types'
import { Hero } from '@/components/scenes/Hero'
import { Problem } from '@/components/scenes/Problem'
import { Turn } from '@/components/scenes/Turn'
import { Ask } from '@/components/scenes/Ask'
import { Sovereign } from '@/components/scenes/Sovereign'
import { Features } from '@/components/scenes/Features'
import { Proof } from '@/components/scenes/Proof'
import { CTA } from '@/components/scenes/CTA'

/**
 * The homepage experience. Client-side because it owns the canvas and the live
 * telemetry; app/page.tsx stays a Server Component so it can export metadata.
 *
 * One fixed canvas sits behind all eight scenes — NOT one canvas per section.
 * The artifacts must survive scene changes: the email buried in scene 2 is the
 * same object ingested in scene 3 and assembled into a card in scene 6. That
 * continuity IS the story, and per-section canvases would reset it every time.
 */
export function HomeExperience() {
  const [telemetry, setTelemetry] = useState<TelemetryState | null>(null)

  // MUST be stable: SwarmCanvas takes this as an effect dependency, and a new
  // identity each render would tear down and rebuild the entire engine.
  // The engine hands back its own mutable state object, so we copy it —
  // otherwise the reference never changes and React skips the re-render.
  const onTelemetry = useCallback((t: TelemetryState) => setTelemetry({ ...t }), [])

  return (
    <>
      <SwarmCanvas onTelemetry={onTelemetry} />
      <Telemetry state={telemetry} />

      {/* The screenplay, in order. */}
      <Hero />
      <Problem />
      <Turn />
      <Ask />
      <Sovereign />
      <Features />
      <Proof />
      <CTA />
    </>
  )
}
