'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'

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

    let raf = 0
    const tick = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  return null
}
