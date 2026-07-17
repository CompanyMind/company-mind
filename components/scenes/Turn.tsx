'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { turn } from '@/content/site'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 3 — THE TURN. The money shot.
 *
 * PINNED for 150vh and SCRUBBED to scroll progress (wired in SwarmCanvas), so
 * the reorganization happens at exactly the rate the visitor scrolls. That is
 * the entire trick: they don't watch the mess resolve, they CAUSE it. Playing
 * this on a timer instead would cost the scene everything.
 *
 * The seal line lands late, with the perimeter's --sovereign pulse: the mess
 * resolved AND none of it left.
 */
export function Turn() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [scrubSealed, setScrubSealed] = useState(false)

  // Reduced motion has no scrub to wait for, so the seal is simply true from the
  // start — the swarm is already showing the resolved brain. Derived at render
  // rather than pushed through an effect, which would cascade a render.
  const sealed = scrubSealed || reduced

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    // Read progress from a ScrollTrigger with the SAME range as the pinned
    // trigger in SwarmCanvas ('top top' -> '+=150%'), so the seal line lands on
    // exactly the frame the perimeter pulses --sovereign (engine: progress >
    // 0.72). Measuring the rect by hand would drift once the section is pinned,
    // because pinning changes what its bounding box means.
    gsap.registerPlugin(ScrollTrigger)
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: '+=150%',
      // setState with an unchanged boolean is a no-op in React, so this does
      // not re-render on every scroll frame — only on the one that flips it.
      onUpdate: (self) => setScrubSealed(self.progress > 0.72),
    })
    return () => st.kill()
  }, [reduced])

  return (
    <section data-scene="turn" ref={ref} className="relative z-10">
      <div data-pin className="flex min-h-dvh flex-col justify-center py-[10vh]">
        <div className="shell">
          <p className="mono-label mb-6">{turn.label}</p>

          <div className="wash max-w-4xl">
            <h2 className="font-display text-display-xl text-ink">
              {turn.headline.map((line) => (
                <span key={line} className="mask-line">
                  <DecodeText as="span" text={line} className="block" />
                </span>
              ))}
            </h2>
          </div>

          <p className="plate mt-8 max-w-measure p-5 text-lg leading-relaxed text-ink-soft">
            {turn.body}
          </p>

          {/* Lands with the perimeter pulse. --sovereign-text because this is
              TEXT: the raw --sovereign fails AA at this size. */}
          <p
            className={`mt-10 font-display text-display-sm text-sovereign-text transition-all duration-700 ease-paper ${
              sealed ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
            }`}
          >
            {turn.seal}
          </p>
        </div>
      </div>
    </section>
  )
}
