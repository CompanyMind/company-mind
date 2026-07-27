'use client'

import { useEffect, useRef, useState } from 'react'
import type { FeaturesCopy } from '@/content/types'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 6 — FEATURES. "The items redistribute into other sections."
 *
 * THE HANDOFF (a deliberate deviation from the brief, for a real reason):
 * the canvas flies artifacts into each card's outline — SwarmCanvas reads these
 * [data-swarm-slot] rects and targets the particles at their perimeter — and
 * then the DOM card fades in and takes over the content.
 *
 * Cards drawn IN canvas would be invisible to screen readers, unselectable and
 * unsearchable. So canvas owns the assembly moment; DOM owns the words. The
 * effect survives intact and nobody is locked out of the content.
 *
 * The cards are quiet on purpose. The assembly is the moment, not the card.
 */
export function Features({ copy }: { copy: FeaturesCopy }) {
  return (
    <section data-scene="features" className="relative z-10 py-[12vh] md:h-[240vh] md:py-0">
      <div className="flex items-center md:sticky md:top-0 md:h-dvh">
        <div className="shell w-full">
          <p className="mono-label mb-6">{copy.label}</p>

          <div className="wash max-w-4xl">
            <h2
              className="font-display text-display-md text-ink"
              aria-label={copy.headline.join(' ')}
            >
              {copy.headline.map((line) => (
                <span key={line} className="mask-line">
                  <DecodeText as="span" text={line} className="block" />
                </span>
              ))}
            </h2>
          </div>

          <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {copy.items.map((item, i) => (
              <FeatureCard key={item.n} n={item.n} title={item.title} body={item.body} index={i} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  n,
  title,
  body,
  index,
}: {
  n: string
  title: string
  body: string
  index: number
}) {
  const ref = useRef<HTMLLIElement>(null)
  const reduced = useReducedMotion()
  const [arrived, setArrived] = useState(false)

  // Under reduced motion the card is simply present — no assembly to wait for.
  // Derived at render rather than pushed through an effect, which would
  // cascade a second render on every mount.
  const settled = arrived || reduced

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let timer: ReturnType<typeof setTimeout>
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        io.disconnect()
        // Let the particles reach the outline before the card claims the space.
        timer = setTimeout(() => setArrived(true), 260 + index * 90)
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
  }, [index, reduced])

  return (
    <li
      ref={ref}
      // SwarmCanvas reads this rect and assembles artifacts around it.
      data-swarm-slot
      className={`rounded-sm border border-line bg-paper-raised p-7 transition-all duration-700 ease-paper ${
        settled ? 'translate-y-0 opacity-100 shadow-card' : 'translate-y-2 opacity-0'
      }`}
    >
      <span className="font-mono text-telemetry text-ink-soft">{n}</span>
      <h3 className="mt-4 font-display text-display-sm text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>
    </li>
  )
}
