'use client'

import { useEffect, useRef } from 'react'
import { SwarmEngine } from '@/lib/swarm/engine'
import type { Telemetry } from '@/lib/swarm/types'
import { canvasAlt } from '@/content/site'

/**
 * Mounts the swarm behind the entire homepage.
 *
 * ONE fixed full-viewport canvas under every section, because the artifacts must
 * persist across scenes: the email buried in scene 2 is the same object ingested
 * in scene 3 and assembled into a card in scene 6. That continuity IS the story.
 *
 * There is no ScrollTrigger and no GSAP here. The engine reads section rects
 * itself, each frame, and the pin is native CSS `position: sticky` inside tall
 * sections. That deleted an entire class of bug: the previous trigger-based
 * version created triggers out of DOM order, so every scene after the pinned one
 * fired ~1.2 viewports early and 'ask' never fired at all — meaning the citation
 * lines had never once rendered. Rect maths has no ordering to get wrong.
 *
 * The canvas is decorative (aria-hidden); its story is available as text.
 */
export function SwarmCanvas({ onTelemetry }: { onTelemetry?: (t: Telemetry) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 767px)').matches
    // Cheap low-power heuristic; wrong in the safe direction (fewer artifacts).
    const cores = navigator.hardwareConcurrency ?? 8
    const lowPower = cores <= 4 || (mobile && cores <= 6)

    const engine = new SwarmEngine(canvas, {
      count: mobile ? 26 : lowPower ? 44 : 64,
      reducedMotion: reduced,
      lowPower,
    })

    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => engine.resize(), 160)
    }
    window.addEventListener('resize', onResize)

    const onMove = (e: PointerEvent) => engine.setPointer(e.clientX, e.clientY)
    const onLeave = () => engine.clearPointer()
    if (window.matchMedia('(pointer: fine)').matches && !reduced) {
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerleave', onLeave)
    }

    // Sampled at ~6Hz rather than per frame: this crosses into React, and a
    // 60Hz setState would re-render the rail for a readout nobody can follow.
    let telemetryTimer: ReturnType<typeof setInterval> | undefined
    if (onTelemetry) telemetryTimer = setInterval(() => onTelemetry(engine.getTelemetry()), 160)

    engine.start()

    // Stop the loop dead when nobody is looking.
    const onVisibility = () => (document.hidden ? engine.stop() : engine.start())
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      if (telemetryTimer) clearInterval(telemetryTimer)
      clearTimeout(resizeTimer)
      engine.destroy()
    }
  }, [onTelemetry])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-dvh w-full"
      />
      {/* The hover readout: an artifact says what it actually is. Positioned by
          the engine, which already knows where the cursor is. */}
      <div
        id="swarm-tip"
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-30 rounded-sm bg-ink px-2.5 py-1.5 font-mono text-[0.6875rem] text-paper opacity-0 transition-opacity duration-200"
      />
      {/* The canvas is decorative, so its story lives here as text. */}
      <p className="sr-only">{canvasAlt}</p>
    </>
  )
}
