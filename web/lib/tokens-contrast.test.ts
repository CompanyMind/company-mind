/**
 * The contrast law in styles/tokens.css, recomputed rather than trusted.
 *
 * The file has always documented WCAG ratios in a comment. A comment cannot
 * fail, so the dark palette — chosen in one sitting, edited forever after —
 * would drift the moment someone nudged a hex "to look right". This test
 * parses the real stylesheet and recalculates every ratio the law claims.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')

/** Every `--name: light-dark(#light, #dark);` declaration in the file. */
function parseTokens(): Record<string, { light: string; dark: string }> {
  const out: Record<string, { light: string; dark: string }> = {}
  const re = /--([a-z0-9-]+):\s*light-dark\(\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)/g
  for (const m of css.matchAll(re)) out[m[1]] = { light: m[2], dark: m[3] }
  return out
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const T = parseTokens()
const SURFACES = ['paper', 'paper-raised', 'paper-sunk'] as const
const MODES = ['light', 'dark'] as const
const GRAPH = [
  'graph-everyone',
  'graph-engineering',
  'graph-finance',
  'graph-legal',
  'graph-sales',
  'graph-anomaly',
  'graph-orphan',
  'graph-muted',
  'graph-faded',
  'graph-ink',
  'graph-halo',
]

describe('tokens.css', () => {
  it('declares every themed token as a light-dark() pair', () => {
    const required = [
      'paper',
      'paper-raised',
      'paper-sunk',
      'ink',
      'ink-soft',
      'line',
      'line-control',
      'brain',
      'query',
      'sovereign',
      'brain-text',
      'query-text',
      'sovereign-text',
      // Atlas canvas marks. Listed here so a NEW token cannot be added to the
      // stylesheet without someone deciding, in this file, whether the contrast
      // law applies to it — which is the whole point of asserting the exact key
      // set rather than a subset.
      ...GRAPH,
    ]
    expect(Object.keys(T).sort()).toEqual([...required].sort())
  })

  // The graph tokens are canvas marks, never text, so the ratios above do not
  // apply to them — see the KNOWN GAP note in tokens.css for why the light
  // department palette is not raised to the 3:1 non-text floor here. What IS
  // enforceable, and worth enforcing, is the two invariants below.

  it('the graph halo is exactly the paper it cuts out of, in both themes', () => {
    // A node is drawn with a halo so it reads as sitting ON the ground rather
    // than floating over it. A halo that is not the ground colour is a visible
    // ring around every node — the exact bug that shipping a dark theme while
    // leaving one hardcoded cream hex behind would cause.
    for (const mode of MODES) expect(T['graph-halo'][mode]).toBe(T.paper[mode])
    for (const mode of MODES) expect(T['graph-ink'][mode]).toBe(T.ink[mode])
  })

  it('every graph token was actually themed, not copy-pasted across', () => {
    // A light value repeated as its own dark value means someone added a token
    // and never looked at it in dark mode. --graph-sales legitimately tracks
    // --brain, which is itself themed, so it is covered by the same rule.
    for (const g of GRAPH)
      expect(T[g].light.toLowerCase(), `--${g} has the same value in both themes`).not.toBe(
        T[g].dark.toLowerCase(),
      )
  })

  it('every token also has a plain fallback declaration before its pair', () => {
    // An engine without light-dark() must keep the light theme, not lose the
    // token entirely — which would leave text and its background the same.
    for (const name of Object.keys(T)) {
      // Whitespace OR a comment may sit between the two declarations — the
      // token file documents several of its values inline, and that prose is
      // worth more than a tidier regex.
      const fallback = new RegExp(
        `--${name}:\\s*#[0-9a-fA-F]{6};(?:\\s|/\\*[\\s\\S]*?\\*/)*--${name}:\\s*light-dark`,
      )
      expect(fallback.test(css), `--${name} has no fallback declaration`).toBe(true)
    }
  })

  it('--ink clears AAA (7:1) on all three surfaces, in both themes', () => {
    for (const mode of MODES)
      for (const s of SURFACES)
        expect(ratio(T.ink[mode], T[s][mode]), `--ink on --${s} (${mode})`).toBeGreaterThanOrEqual(7)
  })

  it('--ink-soft clears AA (4.5:1) on all three surfaces, in both themes', () => {
    for (const mode of MODES)
      for (const s of SURFACES)
        expect(
          ratio(T['ink-soft'][mode], T[s][mode]),
          `--ink-soft on --${s} (${mode})`,
        ).toBeGreaterThanOrEqual(4.5)
  })

  it('the *-text accents clear AA (4.5:1) on all three surfaces, in both themes', () => {
    for (const accent of ['brain-text', 'query-text', 'sovereign-text'])
      for (const mode of MODES)
        for (const s of SURFACES)
          expect(
            ratio(T[accent][mode], T[s][mode]),
            `--${accent} on --${s} (${mode})`,
          ).toBeGreaterThanOrEqual(4.5)
  })

  it('--line-control clears the 3:1 SC 1.4.11 floor for a control boundary', () => {
    for (const mode of MODES)
      for (const s of SURFACES)
        expect(
          ratio(T['line-control'][mode], T[s][mode]),
          `--line-control on --${s} (${mode})`,
        ).toBeGreaterThanOrEqual(3)
  })

  it('the graphic accents clear the 3:1 non-text floor', () => {
    // --query FAILS this on light paper by design and is documented there as
    // GRAPHICS ONLY; the floor is asserted for dark, where the palette was
    // chosen fresh and has no such legacy.
    for (const accent of ['brain', 'sovereign'])
      for (const mode of MODES)
        for (const s of SURFACES)
          expect(
            ratio(T[accent][mode], T[s][mode]),
            `--${accent} on --${s} (${mode})`,
          ).toBeGreaterThanOrEqual(3)
    for (const s of SURFACES)
      expect(ratio(T.query.dark, T[s].dark), `--query on --${s} (dark)`).toBeGreaterThanOrEqual(3)
  })
})
