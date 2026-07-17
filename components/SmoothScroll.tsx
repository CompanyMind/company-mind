'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Lenis smooth scroll, driven by GSAP's ticker and synced to ScrollTrigger.
 *
 * Two things here are load-bearing and easy to get wrong:
 *  1. Lenis must be raf'd by gsap.ticker (not its own rAF) so scroll position
 *     and ScrollTrigger's scrub read from the SAME frame. Two loops = jitter.
 *  2. lagSmoothing(0) — GSAP's lag smoothing fights scrubbed pins after a
 *     long frame and makes the scene-3 ingestion visibly jump.
 *
 * Under prefers-reduced-motion we never instantiate Lenis at all: the page
 * scrolls natively and every scrub is disabled.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    })

    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(raf)
      lenis.destroy()
    }
  }, [])

  return null
}
