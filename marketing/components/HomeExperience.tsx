'use client'

import { useCallback, useState } from 'react'
import { SwarmCanvas } from '@/components/SwarmCanvas'
import { Telemetry } from '@/components/Telemetry'
import type { Telemetry as TelemetryState } from '@/lib/swarm/types'
import type { HomeCopy, Plan } from '@/content/types'
import type { Locale } from '@/i18n/config'
import { Hero } from '@/components/scenes/Hero'
import { Problem } from '@/components/scenes/Problem'
import { Turn } from '@/components/scenes/Turn'
import { Ask } from '@/components/scenes/Ask'
import { Sovereign } from '@/components/scenes/Sovereign'
import { Features } from '@/components/scenes/Features'
import { Proof } from '@/components/scenes/Proof'
import { Pricing } from '@/components/scenes/Pricing'
import { CTA } from '@/components/scenes/CTA'

/**
 * The homepage experience. Client-side because it owns the canvas and the live
 * telemetry; the page stays a Server Component so it can export metadata and
 * resolve the dictionary.
 *
 * Copy arrives as ONE prop and is handed down per scene. That keeps exactly one
 * language in the client bundle: importing a dictionary from a 'use client'
 * module would ship all three to every visitor.
 *
 * One fixed canvas sits behind all nine scenes — NOT one canvas per section.
 * The artifacts must survive scene changes: the email buried in scene 2 is the
 * same object ingested in scene 3 and assembled into a card in scene 6. That
 * continuity IS the story, and per-section canvases would reset it every time.
 */
export function HomeExperience({
  locale,
  copy,
  plans,
}: {
  locale: Locale
  copy: HomeCopy
  /** The same array /pricing renders — one price, one source. */
  plans: Plan[]
}) {
  const [telemetry, setTelemetry] = useState<TelemetryState | null>(null)

  // MUST be stable: SwarmCanvas takes this as an effect dependency, and a new
  // identity each render would tear down and rebuild the entire engine.
  // The engine hands back its own mutable state object, so we copy it —
  // otherwise the reference never changes and React skips the re-render.
  const onTelemetry = useCallback((t: TelemetryState) => setTelemetry({ ...t }), [])

  return (
    <>
      <SwarmCanvas onTelemetry={onTelemetry} alt={copy.canvasAlt} />
      <Telemetry state={telemetry} copy={copy.telemetry} />

      {/* The screenplay, in order. */}
      <Hero copy={copy.hero} />
      <Problem copy={copy.problem} />
      <Turn copy={copy.turn} />
      <Ask copy={copy.ask} />
      <Sovereign copy={copy.sovereign} />
      <Features copy={copy.features} />
      <Proof copy={copy.proof} />
      <Pricing locale={locale} copy={copy.pricing} plans={plans} />
      <CTA locale={locale} copy={copy.cta} />
    </>
  )
}
