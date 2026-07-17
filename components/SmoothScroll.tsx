'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import { addTick, removeTick } from '@/lib/ticker'

/**
 * Lenis smooth scroll, on its own rAF.
 *
 * This used to run through gsap.ticker and publish to ScrollTrigger. Both are
 * gone: the swarm reads section rects itself each frame, and the one pinned
 * scene is native CSS `position: sticky`. With nothing left to notify, Lenis
 * only needs a rAF — which removes GSAP from the page entirely.
 *
 * Under prefers-reduced-motion we never instantiate it at all: the page scrolls
 * natively and every scrubbed effect is disabled.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    })

    // PRIORITY 0 — scroll is written before anything reads it. The engine
    // registers at 1. See lib/ticker.ts: with two independent rAF loops the
    // swarm read every rect a frame before Lenis moved the page, and that
    // one-frame lag is what read as jank.
    const tick = (time: number) => lenis.raf(time)
    addTick(tick, 0)

    return () => {
      removeTick(tick)
      lenis.destroy()
    }
  }, [])

  return null
}
