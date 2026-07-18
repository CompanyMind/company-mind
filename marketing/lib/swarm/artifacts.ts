import type { ArtifactKind } from './types'

/**
 * ============================================================================
 * REALISTIC ARTIFACTS — recognizable objects, never dots.
 * ============================================================================
 * At a glance you must be able to say "that's a chat, that's a PDF, that's a
 * spreadsheet." That legibility is the whole premise: this is a company's real
 * knowledge lying on a desk, not an abstract particle field.
 *
 * WHAT MAKES THEM READ (learned the hard way):
 * The first version drew subtle, tasteful, translucent accents — a faint folded
 * corner, a 10%-ink hairline, interior text at 42% alpha — on a card filled with
 * --paper-raised over a --paper background. That is a 1.09:1 separation. The
 * result was correct, tasteful, and completely invisible: pale ghosts.
 *
 * What actually works is the opposite instinct:
 *   - a PURE WHITE card, not a cream one. Paper on a desk IS white.
 *   - SOLID, FULL-WIDTH COLOUR BARS. A blue band across the whole top of a doc
 *     and a green band across a sheet are readable at 40px from the corner of
 *     your eye. A tasteful corner-fold is not.
 *   - one strong, warm, offset shadow, so the sheet sits ON something.
 * Restraint belongs in the palette and the copy. It does not belong in a 40px
 * icon that has to survive being 6% of the screen and in motion.
 *
 * PERFORMANCE CONTRACT: each card is rasterized ONCE into an offscreen canvas
 * and thereafter only blitted with drawImage. The frame loop never path-draws.
 */

export interface Sprite {
  canvas: HTMLCanvasElement
  /** Full bitmap size in CSS px, shadow padding included. */
  w: number
  h: number
}

export const KINDS: ArtifactKind[] = [
  'chat',
  'doc',
  'image',
  'audio',
  'pdf',
  'email',
  'sheet',
  'slack',
]

/** Card size in CSS px. Real objects differ in shape; so do these. */
const SIZE: Record<ArtifactKind, [number, number]> = {
  chat: [46, 28],
  doc: [34, 42],
  image: [44, 32],
  audio: [48, 18],
  pdf: [34, 42],
  email: [48, 26],
  sheet: [40, 32],
  slack: [46, 26],
}

const PAD = 10

/**
 * App-authentic accents — evocative of the tools this stuff really lives in,
 * without reproducing anyone's mark. A messenger-blue tick, a red PDF tab, a
 * spreadsheet green. Recognizable, not copied.
 */
const C = {
  chatBlue: '#3B9BE0',
  docBlue: '#4A7FE0',
  sheetGreen: '#2E9E63',
  pdfRed: '#D93B3B',
  avatarAmber: '#E0A23B',
  mailBg: '#E8D8BE',
  mailInk: '#B08D4A',
  imgBg: '#DCE9E1',
  imgHill: '#9DBFAE',
  imgHillDark: '#7FAF9A',
  imgSun: '#E5B95C',
  rule: '#C9C4B8',
  ruleStrong: '#8A857A',
  ink: '#1C1B18',
  brain: '#684BFF',
} as const

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** A ruled "line of text" — how the eye reads "document" at this scale. */
function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y: number,
  x2: number,
  color: string,
  lw = 2,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.stroke()
}

/* -------------------------------------------------------------------------- */
/* the eight renderers                                                         */
/* -------------------------------------------------------------------------- */

const DRAW: Record<ArtifactKind, (x: CanvasRenderingContext2D, w: number, h: number) => void> = {
  /** Telegram-style: white bubble, blue tail, message lines, blue double-tick. */
  chat(x, w, h) {
    x.fillStyle = '#fff'
    x.beginPath()
    x.moveTo(4, h - 1)
    x.lineTo(-3, h + 4)
    x.lineTo(11, h - 1)
    x.closePath()
    x.fill()
    x.fillStyle = C.chatBlue
    x.beginPath()
    x.moveTo(4, h - 2)
    x.lineTo(-2, h + 3)
    x.lineTo(9, h - 2)
    x.closePath()
    x.fill()
    line(x, 6, 9, 32, C.rule)
    line(x, 6, 15, 24, C.rule)
    x.strokeStyle = C.chatBlue
    x.lineWidth = 1.4
    x.beginPath()
    x.moveTo(33, 21)
    x.lineTo(35, 23)
    x.lineTo(39, 19)
    x.moveTo(37, 23)
    x.lineTo(41, 19)
    x.stroke()
  },

  /** Word/Docs-style: a solid blue header band. The strongest doc cue there is. */
  doc(x, w) {
    x.fillStyle = C.docBlue
    x.fillRect(0, 0, w, 7)
    x.fillStyle = '#fff'
    x.fillRect(0, 5, w, 2)
    for (let i = 0; i < 4; i++) line(x, 5, 14 + i * 6.5, 5 + (i === 3 ? 14 : 24), C.rule, 1.8)
  },

  /** Photo: tinted frame, two hills, a sun. Colour is the recognition cue. */
  image(x, w, h) {
    x.fillStyle = C.imgBg
    rr(x, 4, 4, w - 8, h - 8, 3)
    x.fill()
    x.fillStyle = C.imgHill
    x.beginPath()
    x.moveTo(8, h - 7)
    x.lineTo(18, 12)
    x.lineTo(26, h - 7)
    x.closePath()
    x.fill()
    x.fillStyle = C.imgHillDark
    x.beginPath()
    x.moveTo(20, h - 7)
    x.lineTo(30, 15)
    x.lineTo(38, h - 7)
    x.closePath()
    x.fill()
    x.fillStyle = C.imgSun
    x.beginPath()
    x.arc(33, 11, 3, 0, Math.PI * 2)
    x.fill()
  },

  /** Voice note: a pill, a play triangle, a teal waveform. */
  audio(x) {
    x.fillStyle = C.ink
    x.beginPath()
    x.moveTo(8, 5.5)
    x.lineTo(8, 12.5)
    x.lineTo(14.5, 9)
    x.closePath()
    x.fill()
    x.strokeStyle = C.brain
    x.lineWidth = 1.8
    x.lineCap = 'round'
    ;[5, 9, 6, 11, 4, 8, 5].forEach((bh, i) => {
      const bx = 20 + i * 3.6
      x.beginPath()
      x.moveTo(bx, 9 - bh / 2)
      x.lineTo(bx, 9 + bh / 2)
      x.stroke()
    })
  },

  /** PDF: the red tab. Real glyphs, because "PDF" is legible at 6px bold. */
  pdf(x) {
    for (let i = 0; i < 4; i++) line(x, 5, 17 + i * 6, 5 + (i === 3 ? 12 : 24), C.rule, 1.8)
    x.fillStyle = C.pdfRed
    rr(x, 4, 3, 20, 9, 2)
    x.fill()
    x.fillStyle = '#fff'
    x.font = 'bold 6px ui-monospace, monospace'
    x.fillText('PDF', 7, 9.8)
  },

  /** Inbox row: an avatar, a bold sender, a subject. */
  email(x, w, h) {
    x.fillStyle = C.mailBg
    x.beginPath()
    x.arc(10, h / 2, 6, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = C.mailInk
    x.font = 'bold 7px ui-sans-serif, system-ui, sans-serif'
    x.fillText('A', 7.6, h / 2 + 2.5)
    line(x, 20, 9, 40, C.ruleStrong, 2)
    line(x, 20, 16, 44, C.rule, 1.8)
  },

  /** Spreadsheet: a solid green header band and a real grid. */
  sheet(x, w, h) {
    x.fillStyle = C.sheetGreen
    x.fillRect(0, 0, w, 7)
    x.strokeStyle = '#CFE5D6'
    x.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      x.beginPath()
      x.moveTo(0, 7 + i * 8.3)
      x.lineTo(w, 7 + i * 8.3)
      x.stroke()
    }
    for (let i = 1; i < 4; i++) {
      x.beginPath()
      x.moveTo(i * 10, 7)
      x.lineTo(i * 10, h)
      x.stroke()
    }
  },

  /** Team chat: a colour-block avatar and two lines. */
  slack(x) {
    x.fillStyle = C.avatarAmber
    rr(x, 5, 6, 13, 13, 3.5)
    x.fill()
    line(x, 23, 9, 37, C.ruleStrong, 2)
    line(x, 23, 16, 41, C.rule, 1.8)
  },
}

/**
 * Rasterize one card.
 *
 * `s` is the supersample factor — the bitmap is drawn at s× and blitted down,
 * which is what keeps a 40px card crisp while it rotates. Capped at 2.5: past
 * that you are paying fill rate for detail nobody can resolve on a moving object.
 */
export function makeSprite(kind: ArtifactKind, s: number): Sprite {
  const [w, h] = SIZE[kind]
  const c = document.createElement('canvas')
  c.width = (w + PAD * 2) * s
  c.height = (h + PAD * 2) * s
  const x = c.getContext('2d')!
  x.scale(s, s)
  x.translate(PAD, PAD)

  const radius = kind === 'audio' ? h / 2 : 4

  // One warm, offset shadow — the sheet is resting ON the paper, not floating.
  x.shadowColor = 'rgba(96,78,48,0.32)'
  x.shadowBlur = 5
  x.shadowOffsetY = 2.5
  x.fillStyle = '#FFFFFF'
  rr(x, 0, 0, w, h, radius)
  x.fill()
  x.shadowColor = 'transparent'

  x.strokeStyle = 'rgba(28,27,24,0.10)'
  x.lineWidth = 0.75
  rr(x, 0, 0, w, h, radius)
  x.stroke()

  DRAW[kind](x, w, h)

  return { canvas: c, w: w + PAD * 2, h: h + PAD * 2 }
}

/** Supersample factor for the atlas. */
export function spriteScale(lowPower: boolean) {
  return Math.min(2.5, (window.devicePixelRatio || 1) * (lowPower ? 1 : 1.6))
}

/* -------------------------------------------------------------------------- */
/* labels — what an artifact says it is on hover                               */
/* -------------------------------------------------------------------------- */

/**
 * Plausible internal debris: the texture of a real company's drive. These are
 * illustrative examples of a hypothetical customer's OWN files — not a claim
 * about any real customer, because there are none yet.
 */
const LABELS: Record<ArtifactKind, string[]> = {
  chat: ['ops-chat: "can you resend that?"', 'tg: "final numbers attached" ✓✓'],
  doc: ['Q3_board_notes_FINAL_v4.docx', 'onboarding_playbook (copy).docx'],
  image: ['whiteboard_2026-03-11.jpg', 'IMG_4471_scan.png'],
  audio: ['voice_memo_0912.m4a', 'standup_recording_44min.mp3'],
  pdf: ['meridian_msa_executed.pdf', 'audit_findings_2025.pdf'],
  email: ['re: contract renewal — 217 replies', 'fwd: fwd: pricing approval??'],
  sheet: ['contract_terms_tracker.xlsx', 'headcount_plan_REAL_final.xlsx'],
  slack: ['#eng: "where does this config live?"', '#legal: "who owns this doc?"'],
}

export function labelFor(kind: ArtifactKind, i: number): string {
  return LABELS[kind][i % LABELS[kind].length]
}
