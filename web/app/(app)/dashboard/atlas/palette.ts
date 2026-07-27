'use client'

import { useEffect, useState } from 'react'

export type GraphPalette = {
  everyone: string
  engineering: string
  finance: string
  legal: string
  sales: string
  anomaly: string
  orphan: string
  muted: string
  faded: string
  ink: string
  halo: string
  /** Whether the resolved palette is the dark one. Derived from the actual
   *  resolved --paper rather than from the data-theme attribute, so it stays
   *  correct under `system` without duplicating the media query. */
  isDark: boolean
}

const TOKENS: Record<keyof Omit<GraphPalette, 'isDark'>, string> = {
  everyone: '--graph-everyone',
  engineering: '--graph-engineering',
  finance: '--graph-finance',
  legal: '--graph-legal',
  sales: '--graph-sales',
  anomaly: '--graph-anomaly',
  orphan: '--graph-orphan',
  muted: '--graph-muted',
  faded: '--graph-faded',
  ink: '--graph-ink',
  halo: '--graph-halo',
}

/** Rough perceived lightness of a #rrggbb, 0..1. Only used to answer "is this
 *  the dark palette?", so the cheap sRGB weighting is plenty. */
function isDarkHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5
}

function read(): GraphPalette {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  const out = {} as GraphPalette
  for (const [key, token] of Object.entries(TOKENS)) {
    out[key as keyof typeof TOKENS] = v(token)
  }
  out.isDark = isDarkHex(v('--paper'))
  return out
}

/**
 * The Atlas canvas palette, read from CSS custom properties at runtime.
 *
 * A <canvas> cannot inherit CSS, so these colours were hardcoded hexes tuned
 * for the cream ground — which meant the graph was the one surface a dark theme
 * could not reach. Reading them through getComputedStyle is the same pattern
 * marketing/lib/swarm/tokens.ts already uses, and it keeps tokens.css the single
 * source of truth.
 *
 * Re-read on two signals: the data-theme attribute changing (an explicit choice
 * in Settings) and the OS preference changing (which matters while data-theme
 * is 'system'). Returns null until the first client read, so the caller never
 * paints with an empty palette during SSR.
 */
export function useGraphPalette(): GraphPalette | null {
  const [palette, setPalette] = useState<GraphPalette | null>(null)

  useEffect(() => {
    const update = () => setPalette(read())
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])

  return palette
}
