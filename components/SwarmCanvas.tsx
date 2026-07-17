'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SwarmEngine } from '@/lib/swarm/engine'
import type { SceneId, Slot, Telemetry } from '@/lib/swarm/types'
import { canvasAlt } from '@/content/site'

/**
 * Mounts the swarm behind the entire homepage and wires scroll to it.
 *
 * The canvas is FIXED and full-viewport, sitting under every section, because
 * the artifacts must persist across scenes — that continuity is the story.
 * Sections above it are transparent and simply declare which scene they are
 * via data-scene.
 *
 * The canvas is decorative (aria-hidden). The story it tells is available to
 * screen readers as text via canvasAlt — the animation is never the only way
 * to receive the message.
 */

const SCENES: SceneId[] = [
  'hero',
  'problem',
  'turn',
  'ask',
  'sovereign',
  'features',
  'proof',
  'cta',
]

export function SwarmCanvas({ onTelemetry }: { onTelemetry?: (t: Telemetry) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SwarmEngine | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 767px)').matches

    // Low-power heuristic: few cores or a coarse pointer with a small screen.
    // Cheap, no fingerprinting, and wrong in the safe direction (fewer effects).
    const cores = navigator.hardwareConcurrency ?? 8
    const lowPower = cores <= 4 || (mobile && cores <= 6)

    const engine = new SwarmEngine(canvas, {
      count: mobile ? 28 : lowPower ? 44 : 70,
      reducedMotion: reduced,
      lowPower,
    })
    engineRef.current = engine

    // ---- resize (debounced; rebuilding the atlas is not free) ------------
    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        engine.resize()
        ScrollTrigger.refresh()
      }, 160)
    }
    window.addEventListener('resize', onResize)

    // ---- pointer ---------------------------------------------------------
    const onMove = (e: PointerEvent) => engine.setPointer(e.clientX, e.clientY)
    const onLeave = () => engine.clearPointer()
    if (window.matchMedia('(pointer: fine)').matches && !reduced) {
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerleave', onLeave)
    }

    // ---- telemetry pump --------------------------------------------------
    // Sampled at 6Hz rather than per frame: this crosses into React, and a
    // 60Hz setState would re-render the rail 60x/sec for a readout the eye
    // cannot follow anyway.
    let telemetryTimer: ReturnType<typeof setInterval> | undefined
    if (onTelemetry) {
      telemetryTimer = setInterval(() => onTelemetry(engine.getTelemetry()), 160)
    }

    // ---- reduced motion: one static frame, no loop, no triggers ----------
    if (reduced) {
      engine.start()
      onTelemetry?.(engine.getTelemetry())
      return () => {
        window.removeEventListener('resize', onResize)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerleave', onLeave)
        if (telemetryTimer) clearInterval(telemetryTimer)
        engine.destroy()
      }
    }

    engine.start()

    // ---- pause when offscreen / hidden -----------------------------------
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) engine.start()
        else engine.stop()
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    const onVisibility = () => (document.hidden ? engine.stop() : engine.start())
    document.addEventListener('visibilitychange', onVisibility)

    // ---- scroll → scenes -------------------------------------------------
    gsap.registerPlugin(ScrollTrigger)
    const triggers: ScrollTrigger[] = []

    const ctx = gsap.context(() => {
      // EXACTLY ONE SCENE MAY BE ACTIVE AT A TIME.
      //
      // The obvious ranges ('top bottom' -> 'bottom top') keep a trigger live
      // across ~2x the viewport, so two or three neighbouring scenes are all
      // active simultaneously and every one of them calls setScene() each
      // frame. Last writer wins, the engine thrashes between scenes, and the
      // telemetry reports whichever section updated last rather than the one
      // you are actually looking at.
      //
      // 'top center' -> 'bottom center' makes each section own the viewport
      // centre-line and hand off cleanly to the next: section A ends exactly
      // where section B begins. No overlap, no gap, no fight.
      for (const id of SCENES) {
        // 'turn' is excluded: it has its own pinned trigger below, and giving
        // it two triggers would reintroduce exactly the fight described above.
        if (id === 'turn') continue

        const el = document.querySelector<HTMLElement>(`[data-scene="${id}"]`)
        if (!el) continue

        triggers.push(
          ScrollTrigger.create({
            trigger: el,
            start: 'top center',
            end: 'bottom center',
            onUpdate: (self) => engine.setScene(id, self.progress),
            // Re-assert on entry so a fast scroll that skips an onUpdate never
            // leaves the engine on a stale scene.
            onEnter: () => engine.setScene(id, 0),
            onEnterBack: () => engine.setScene(id, 1),
          }),
        )
      }

      // Scene 3 — THE MONEY SHOT. Pinned for 150vh and scrubbed, so the
      // ingestion advances at exactly the rate the visitor scrolls: they don't
      // watch the mess resolve, they cause it.
      const turn = document.querySelector<HTMLElement>('[data-scene="turn"]')
      if (turn) {
        triggers.push(
          ScrollTrigger.create({
            trigger: turn,
            start: 'top top',
            end: '+=150%',
            pin: turn.querySelector('[data-pin]') ?? true,
            pinSpacing: true,
            scrub: 0.6,
            onUpdate: (self) => engine.setScene('turn', self.progress),
            onEnter: () => engine.setScene('turn', 0),
            onEnterBack: () => engine.setScene('turn', 1),
          }),
        )
      }

      // Feature cards: hand the engine their real rects so the artifacts
      // assemble into the actual UI rather than an approximation of it.
      const syncSlots = () => {
        const els = document.querySelectorAll<HTMLElement>('[data-swarm-slot]')
        const slots: Slot[] = []
        els.forEach((e) => {
          const r = e.getBoundingClientRect()
          slots.push({ x: r.left, y: r.top, w: r.width, h: r.height })
        })
        engine.setSlots(slots)
      }
      const featuresEl = document.querySelector<HTMLElement>('[data-scene="features"]')
      if (featuresEl) {
        triggers.push(
          ScrollTrigger.create({
            trigger: featuresEl,
            start: 'top bottom',
            end: 'bottom top',
            onUpdate: syncSlots,
          }),
        )
      }

      // Citation anchor: where the answer actually sits on screen, so the
      // lines land on the text rather than near it.
      const askEl = document.querySelector<HTMLElement>('[data-cite-anchor]')
      if (askEl) {
        triggers.push(
          ScrollTrigger.create({
            trigger: document.querySelector<HTMLElement>('[data-scene="ask"]') ?? askEl,
            start: 'top bottom',
            end: 'bottom top',
            onUpdate: () => {
              const r = askEl.getBoundingClientRect()
              engine.setCiteAnchor(r.right - 8, r.top + r.height / 2, true)
            },
            onLeave: () => engine.setCiteAnchor(0, 0, false),
            onLeaveBack: () => engine.setCiteAnchor(0, 0, false),
          }),
        )
      }
    })

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      if (telemetryTimer) clearInterval(telemetryTimer)
      clearTimeout(resizeTimer)
      io.disconnect()
      triggers.forEach((t) => t.kill())
      ctx.revert()
      engine.destroy()
      engineRef.current = null
    }
  }, [onTelemetry])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-dvh w-full"
      />
      {/* The canvas is decorative, so its story lives here as text. Anyone who
          cannot see the animation still receives the message. */}
      <p className="sr-only">{canvasAlt}</p>
    </>
  )
}
