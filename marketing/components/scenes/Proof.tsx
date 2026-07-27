'use client'

import { useEffect, useRef, useState } from 'react'
import type { ProofCopy } from '@/content/types'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { DecodeText } from '@/components/DecodeText'

/**
 * SCENE 7 — PROOF.
 *
 * CompanyMind is PRE-LAUNCH. There are no customers, so there are no customer
 * numbers here. Every figure below is true BY CONSTRUCTION — it follows from
 * how the system is built, not from how many people bought it. "0 bytes egress"
 * is not a counter that happens to read zero; there is no outbound path for it
 * to measure.
 *
 * The section says this out loud rather than hoping nobody asks. A regulated
 * buyer checks, and being caught inflating traction costs more than having none.
 *
 * DO NOT add latency or accuracy figures here. They are unverifiable until
 * there is a real deployment, and inventing them would poison the one thing
 * this page is for.
 */
export function Proof({ copy }: { copy: ProofCopy }) {
  return (
    <section data-scene="proof" className="relative z-10 py-[12vh] md:h-[170vh] md:py-0">
      <div className="flex items-center md:sticky md:top-0 md:h-dvh">
        <div className="shell w-full">
          <p className="mono-label mb-6">{copy.label}</p>

          <div className="wash max-w-3xl">
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

          <p className="plate mt-8 max-w-measure p-5 text-body text-ink-soft">{copy.body}</p>

          <dl className="mt-20 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {copy.metrics.map((m) => (
              <Metric key={m.label} {...m} />
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

function Metric({
  value,
  suffix,
  label,
  note,
}: {
  value: number
  suffix: string
  label: string
  note: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [counted, setCounted] = useState(0)

  // Reduced motion shows the final figure immediately — derived at render, not
  // pushed through an effect.
  const shown = reduced ? value : counted

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        io.disconnect()

        // Zero is already the answer — counting up to it would be theatre.
        // (And "0 bytes egress" counting up from 0 to 0 says nothing.)
        if (value === 0) return

        const DURATION = 1100
        let start = 0
        const tick = (t: number) => {
          if (!start) start = t
          const p = Math.min(1, (t - start) / DURATION)
          // easeOutExpo — fast, then settles. Reads as "resolving", not "spinning".
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
          setCounted(Math.round(value * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [value, reduced])

  return (
    <div ref={ref} className="bg-paper-raised p-6">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-display-md tabular-nums text-ink">
          {shown}
          {suffix}
        </span>
        <span className="mt-3 block font-mono text-telemetry uppercase tracking-[0.1em] text-ink">
          {label}
        </span>
        <span className="mt-3 block text-sm leading-relaxed text-ink-soft">{note}</span>
      </dd>
    </div>
  )
}
