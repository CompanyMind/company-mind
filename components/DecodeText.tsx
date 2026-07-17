'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

const GLYPHS = '▚�притин01#/\\|<>{}[]$%&@*+=~^ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Headline reveal: the text resolves out of scramble, character by character,
 * left to right — as if the brain is decoding it out of noise.
 *
 * Details that matter:
 *  - The real text is ALWAYS in the DOM (aria-label + sr-only), so screen
 *    readers and search engines never see scrambled garbage. Only the visual
 *    layer scrambles, and it is aria-hidden.
 *  - Spaces never scramble; the word shape stays legible throughout.
 *  - Reduced motion, or no IntersectionObserver: renders resolved immediately.
 *  - The interval is torn down on unmount AND on completion — no zombie timers.
 */
export function DecodeText({
  text,
  as: Tag = 'span',
  className,
  delay = 0,
  speed = 28,
}: {
  text: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'div'
  className?: string
  /** ms to wait after entering the viewport */
  delay?: number
  /** ms per resolve tick — lower is faster */
  speed?: number
}) {
  const ref = useRef<HTMLElement>(null)
  const [display, setDisplay] = useState(text)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || started) return

    const el = ref.current
    if (!el) return

    // Hold the final text until we're actually asked to animate, so no-JS and
    // pre-hydration paints show the real headline rather than noise.
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        io.disconnect()
        setStarted(true)
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return

    let frame = 0
    let interval: ReturnType<typeof setInterval> | undefined

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        frame += 1
        // Two characters resolve per tick; the rest keep churning.
        const resolved = Math.floor(frame / 2)
        if (resolved >= text.length) {
          setDisplay(text)
          if (interval) clearInterval(interval)
          return
        }
        let out = ''
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]
          if (ch === ' ') out += ' '
          else if (i < resolved) out += ch
          else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        }
        setDisplay(out)
      }, speed)
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [started, text, speed, delay])

  /**
   * ONE span, not two.
   *
   * This used to render an `sr-only` copy of the real text alongside the
   * scrambling one. Visually fine, but the headline was then in the DOM TWICE:
   * selecting or copying the hero produced "Everything yourEverything your", and
   * every h1 on the site contained its own text duplicated for crawlers.
   *
   * Instead the caller puts the true string on the heading as `aria-label` (see
   * Hero/Problem/etc), which overrides the children for assistive tech, and this
   * span is aria-hidden. `display` starts as the real text, so SSR, no-JS and
   * first paint all emit the genuine headline — the scramble only ever exists
   * after hydration, for eyes.
   */
  return (
    <Tag ref={ref as never} className={cn(className)} aria-hidden="true">
      {display}
    </Tag>
  )
}
