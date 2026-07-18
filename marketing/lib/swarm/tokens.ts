/**
 * The bridge between styles/tokens.css and the canvas.
 *
 * The canvas cannot use Tailwind classes, so without this it would grow its own
 * hardcoded palette and drift out of sync with the CSS the moment anyone tuned
 * a color. Instead we read the SAME custom properties off :root at runtime.
 * One source of truth, enforced by construction.
 *
 * Read once at init (getComputedStyle forces style resolution — never call this
 * inside the frame loop).
 */

export interface SwarmPalette {
  paper: string
  paperRaised: string
  paperSunk: string
  ink: string
  inkSoft: string
  line: string
  brain: string
  query: string
  sovereign: string
}

const FALLBACK: SwarmPalette = {
  paper: '#F3EEE3',
  paperRaised: '#FBF8F1',
  paperSunk: '#E8E1D2',
  ink: '#1C1B18',
  inkSoft: '#635E54',
  line: '#D8D0BE',
  brain: '#0F8A7E',
  query: '#E07B39',
  sovereign: '#D8315B',
}

export function readPalette(): SwarmPalette {
  if (typeof window === 'undefined') return FALLBACK
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb
  return {
    paper: v('--paper', FALLBACK.paper),
    paperRaised: v('--paper-raised', FALLBACK.paperRaised),
    paperSunk: v('--paper-sunk', FALLBACK.paperSunk),
    ink: v('--ink', FALLBACK.ink),
    inkSoft: v('--ink-soft', FALLBACK.inkSoft),
    line: v('--line', FALLBACK.line),
    brain: v('--brain', FALLBACK.brain),
    query: v('--query', FALLBACK.query),
    sovereign: v('--sovereign', FALLBACK.sovereign),
  }
}

/**
 * App-authentic accents for the artifact cards — evocative of the tools these
 * things really live in, without reproducing anyone's trademark.
 * A Telegram-*style* blue, a Docs-*style* blue. Recognizable, not copied.
 */
export const APP_ACCENT = {
  chat: '#34AADF', // messenger blue
  doc: '#3B75D1', // word-processor blue
  image: '#C2703F', // warm photo tint
  audio: '#7C5CD6', // voice-note violet
  pdf: '#D93B3B', // the red tab everyone knows
  email: '#8A8378', // inbox gray
  sheet: '#1E9E5A', // spreadsheet green
  slack: '#6B3F72', // team-chat aubergine
} as const

/** Add alpha to a #rrggbb string. Called at init, never per frame. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
