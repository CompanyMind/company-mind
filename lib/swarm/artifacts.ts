import type { ArtifactKind } from './types'
import { APP_ACCENT, withAlpha, type SwarmPalette } from './tokens'

/**
 * ============================================================================
 * REALISTIC ARTIFACTS — the swarm is made of RECOGNIZABLE OBJECTS, never dots.
 * ============================================================================
 * At a glance you must be able to say "that's a chat, that's a PDF, that's an
 * image." That legibility is the entire premise: this is a company's actual
 * knowledge lying on a desk, not an abstract particle field.
 *
 * PERFORMANCE CONTRACT
 * Every card is rasterized ONCE into an offscreen canvas — shadow baked in —
 * and thereafter only blitted with drawImage. We never path-draw a card inside
 * the frame loop. 70 artifacts x ~14 path ops each would be ~1000 path ops per
 * frame; instead it is 70 drawImage calls, which the GPU eats for breakfast.
 *
 * BRAND NOTE
 * These are app-*authentic*, not app-*copied*: a Telegram-style bubble, a
 * Docs-style page. Evocative shapes and colors we are free to draw. No
 * third-party logos or exact marks appear anywhere.
 *
 * Text inside a 40px card would render at ~3px and read as mud, so body text is
 * abstracted to ruled lines — which is how the eye reads "document" anyway.
 * Only the PDF tab carries real glyphs, because "PDF" is legible at 6px bold
 * and is the single strongest recognition cue in the whole set.
 */

export interface Sprite {
  canvas: HTMLCanvasElement
  /** Full bitmap size in CSS px, shadow padding included. */
  w: number
  h: number
  /** Offset from sprite origin to card centre, in CSS px. */
  cx: number
  cy: number
}

export type SpriteAtlas = Map<string, Sprite>

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

/** Three visual variants per kind keeps 70 objects from looking like clones. */
export const VARIANTS = 3

const PAD = 8 // room for the soft paper shadow

/** Card dimensions in CSS px. Shapes differ because real objects differ. */
const SIZE: Record<ArtifactKind, [number, number]> = {
  chat: [44, 26],
  doc: [30, 38],
  image: [40, 30],
  audio: [44, 18],
  pdf: [30, 38],
  email: [46, 26],
  sheet: [40, 30],
  slack: [44, 26],
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  // roundRect is available everywhere we support; the fallback keeps the
  // renderer honest on anything older rather than throwing mid-frame.
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** A ruled "line of text". The workhorse of legibility at this scale. */
function ruled(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  h = 1.6,
) {
  ctx.fillStyle = color
  rr(ctx, x, y, w, h, h / 2)
  ctx.fill()
}

/** The card body every artifact sits on: warm paper, hairline, soft warm shadow. */
function base(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  lowPower: boolean,
  radius = 4,
) {
  if (!lowPower) {
    // Warm, low, soft — an object resting on paper. Never a hard drop-shadow.
    ctx.shadowColor = 'rgba(60, 48, 30, 0.22)'
    ctx.shadowBlur = 5
    ctx.shadowOffsetY = 1.5
  }
  ctx.fillStyle = p.paperRaised
  rr(ctx, 0, 0, w, h, radius)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.strokeStyle = withAlpha(p.ink, 0.1)
  ctx.lineWidth = 0.75
  rr(ctx, 0.4, 0.4, w - 0.8, h - 0.8, radius)
  ctx.stroke()
}

/* -------------------------------------------------------------------------- */
/* the eight renderers                                                         */
/* -------------------------------------------------------------------------- */

/** Telegram-style: white bubble, blue tail, one line, timestamp, double ticks. */
function drawChat(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, 6)

  // the tail — bottom-left, the shape that says "message"
  ctx.fillStyle = p.paperRaised
  ctx.beginPath()
  ctx.moveTo(2, h - 5)
  ctx.lineTo(-2.5, h + 1)
  ctx.lineTo(6, h - 1.5)
  ctx.closePath()
  ctx.fill()

  // messenger-blue accent bar — the recognition cue
  ctx.fillStyle = APP_ACCENT.chat
  rr(ctx, 0, 0, 2.5, h, 1.25)
  ctx.fill()

  const soft = withAlpha(p.inkSoft, 0.5)
  ruled(ctx, 7, 8, [26, 30, 22][v], withAlpha(p.ink, 0.42))
  ruled(ctx, 7, 13, [18, 14, 24][v], soft)

  // timestamp + double ticks, bottom right
  ruled(ctx, w - 17, h - 6.5, 6, withAlpha(p.inkSoft, 0.4), 1.4)
  ctx.strokeStyle = APP_ACCENT.chat
  ctx.lineWidth = 0.9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(w - 9, h - 6)
  ctx.lineTo(w - 7.5, h - 4.5)
  ctx.lineTo(w - 4.5, h - 8)
  ctx.moveTo(w - 6.5, h - 6)
  ctx.lineTo(w - 5, h - 4.5)
  ctx.lineTo(w - 2, h - 8)
  ctx.stroke()
}

/** Docs/Word-style: portrait page, colored corner, ruled text. */
function drawDoc(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, 3)

  // folded corner — the universal "this is a document"
  ctx.fillStyle = withAlpha(APP_ACCENT.doc, 0.22)
  ctx.beginPath()
  ctx.moveTo(w - 9, 0)
  ctx.lineTo(w, 9)
  ctx.lineTo(w, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = withAlpha(APP_ACCENT.doc, 0.55)
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(w - 9, 0)
  ctx.lineTo(w - 9, 9)
  ctx.lineTo(w, 9)
  ctx.stroke()

  // title line, then body
  ruled(ctx, 4, 13, w - 14, withAlpha(p.ink, 0.5), 2)
  const soft = withAlpha(p.inkSoft, 0.42)
  const pattern = [
    [22, 18, 21, 12],
    [20, 22, 15, 19],
    [21, 14, 22, 16],
  ][v]
  pattern.forEach((len, i) => ruled(ctx, 4, 19 + i * 4.4, len, soft))
}

/** Photo thumbnail: tinted, rounded, mountain + sun glyph. */
function drawImage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, 4)

  const tint = [APP_ACCENT.image, '#6E8B6B', '#7C5CD6'][v]
  ctx.save()
  rr(ctx, 2, 2, w - 4, h - 4, 2.5)
  ctx.clip()

  ctx.fillStyle = withAlpha(tint, 0.16)
  ctx.fillRect(2, 2, w - 4, h - 4)

  // sun
  ctx.fillStyle = withAlpha(tint, 0.5)
  ctx.beginPath()
  ctx.arc(w - 10, 9, 2.6, 0, Math.PI * 2)
  ctx.fill()

  // mountains
  ctx.fillStyle = withAlpha(tint, 0.62)
  ctx.beginPath()
  ctx.moveTo(2, h - 4)
  ctx.lineTo(13, 12)
  ctx.lineTo(23, h - 4)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = withAlpha(tint, 0.42)
  ctx.beginPath()
  ctx.moveTo(15, h - 4)
  ctx.lineTo(25, 16)
  ctx.lineTo(w - 2, h - 4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Voice note: pill, play triangle, waveform. */
function drawAudio(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, h / 2)

  // play button
  ctx.fillStyle = withAlpha(APP_ACCENT.audio, 0.14)
  ctx.beginPath()
  ctx.arc(9, h / 2, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = APP_ACCENT.audio
  ctx.beginPath()
  ctx.moveTo(7.2, h / 2 - 2.8)
  ctx.lineTo(12, h / 2)
  ctx.lineTo(7.2, h / 2 + 2.8)
  ctx.closePath()
  ctx.fill()

  // waveform — deterministic per variant so it never flickers between frames
  const bars = [
    [3, 6, 9, 5, 8, 4, 7, 3, 5, 2],
    [2, 5, 8, 10, 6, 3, 7, 9, 4, 2],
    [4, 7, 3, 8, 5, 9, 4, 6, 3, 5],
  ][v]
  ctx.fillStyle = withAlpha(APP_ACCENT.audio, 0.55)
  bars.forEach((bh, i) => {
    const x = 18 + i * 2.5
    rr(ctx, x, h / 2 - bh / 2, 1.3, bh, 0.65)
    ctx.fill()
  })
}

/** PDF: white page, the red tab. The strongest recognition cue in the set. */
function drawPdf(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, 3)

  const soft = withAlpha(p.inkSoft, 0.4)
  const pattern = [
    [20, 16, 21, 13],
    [18, 21, 14, 19],
    [21, 13, 20, 17],
  ][v]
  pattern.forEach((len, i) => ruled(ctx, 4, 6 + i * 4.2, len, soft))

  // the red tab — real glyphs, legible at 6px bold, worth the exception
  ctx.fillStyle = APP_ACCENT.pdf
  rr(ctx, 3, h - 13, 15, 9.5, 1.5)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 6.5px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PDF', 10.5, h - 8)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

/** Inbox row: sender line, subject line, envelope mark. */
function drawEmail(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, 3)

  // envelope glyph
  ctx.strokeStyle = withAlpha(APP_ACCENT.email, 0.85)
  ctx.lineWidth = 0.9
  rr(ctx, 4, 6, 11, 8, 1.2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(4, 6.5)
  ctx.lineTo(9.5, 10.5)
  ctx.lineTo(15, 6.5)
  ctx.stroke()

  // sender (bold) + subject
  ruled(ctx, 19, 7.5, [20, 16, 22][v], withAlpha(p.ink, 0.5), 2)
  ruled(ctx, 19, 12.5, [23, 21, 18][v], withAlpha(p.inkSoft, 0.42))
  ruled(ctx, 4, 18.5, w - 10, withAlpha(p.inkSoft, 0.3))
}

/** Spreadsheet: green header, real grid. */
function drawSheet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, 3)

  // header band
  ctx.fillStyle = withAlpha(APP_ACCENT.sheet, 0.85)
  rr(ctx, 2, 2, w - 4, 5.5, 1.5)
  ctx.fill()

  ctx.strokeStyle = withAlpha(APP_ACCENT.sheet, 0.3)
  ctx.lineWidth = 0.6
  ctx.beginPath()
  for (let c = 1; c < 4; c++) {
    const x = 2 + ((w - 4) / 4) * c
    ctx.moveTo(x, 8)
    ctx.lineTo(x, h - 2)
  }
  for (let r = 1; r < 4; r++) {
    const y = 8 + ((h - 10) / 4) * r
    ctx.moveTo(2, y)
    ctx.lineTo(w - 2, y)
  }
  ctx.stroke()

  // a couple of filled cells so it reads as data, not graph paper
  ctx.fillStyle = withAlpha(APP_ACCENT.sheet, 0.18)
  const cell = [
    [1, 1],
    [2, 0],
    [0, 2],
  ][v]
  ctx.fillRect(2 + ((w - 4) / 4) * cell[0], 8 + ((h - 10) / 4) * cell[1], (w - 4) / 4, (h - 10) / 4)
}

/** Team chat: avatar dot, name, message. */
function drawSlack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: SwarmPalette,
  v: number,
  lp: boolean,
) {
  base(ctx, w, h, p, lp, 4)

  ctx.fillStyle = withAlpha(APP_ACCENT.slack, 0.8)
  rr(ctx, 4, 5, 8, 8, 2.5)
  ctx.fill()

  ruled(ctx, 16, 6, [14, 11, 16][v], withAlpha(p.ink, 0.5), 2)
  ruled(ctx, 16, 11, [24, 20, 22][v], withAlpha(p.inkSoft, 0.42))
  ruled(ctx, 4, 18, [30, 26, 34][v], withAlpha(p.inkSoft, 0.32))
}

const RENDERERS: Record<
  ArtifactKind,
  (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    p: SwarmPalette,
    v: number,
    lp: boolean,
  ) => void
> = {
  chat: drawChat,
  doc: drawDoc,
  image: drawImage,
  audio: drawAudio,
  pdf: drawPdf,
  email: drawEmail,
  sheet: drawSheet,
  slack: drawSlack,
}

/* -------------------------------------------------------------------------- */
/* atlas                                                                       */
/* -------------------------------------------------------------------------- */

export function spriteKey(kind: ArtifactKind, variant: number) {
  return `${kind}:${variant}`
}

/**
 * Rasterize every (kind, variant) once. Called at init and on DPR change ONLY.
 * 8 kinds x 3 variants = 24 small bitmaps, a few hundred KB of VRAM, and after
 * this the frame loop never touches a path again.
 */
export function buildAtlas(palette: SwarmPalette, dpr: number, lowPower: boolean): SpriteAtlas {
  const atlas: SpriteAtlas = new Map()

  for (const kind of KINDS) {
    const [cw, ch] = SIZE[kind]
    const fw = cw + PAD * 2
    const fh = ch + PAD * 2

    for (let v = 0; v < VARIANTS; v++) {
      const c = document.createElement('canvas')
      c.width = Math.ceil(fw * dpr)
      c.height = Math.ceil(fh * dpr)
      const ctx = c.getContext('2d')
      if (!ctx) continue

      ctx.scale(dpr, dpr)
      ctx.translate(PAD, PAD)
      RENDERERS[kind](ctx, cw, ch, palette, v, lowPower)

      atlas.set(spriteKey(kind, v), { canvas: c, w: fw, h: fh, cx: fw / 2, cy: fh / 2 })
    }
  }

  return atlas
}

/* -------------------------------------------------------------------------- */
/* labels — what each artifact says it is on hover                             */
/* -------------------------------------------------------------------------- */

/**
 * Plausible internal debris. These are illustrative examples of a hypothetical
 * customer's OWN files — the texture of real corporate mess — not a claim about
 * any real company or customer.
 */
const LABELS: Record<ArtifactKind, string[]> = {
  chat: [
    're: contract — 217 replies',
    'ops standup — 4y archive',
    '@here does anyone have the deck',
  ],
  doc: ['Q3_report_final_v4.docx', 'onboarding_v2_REAL_final.docx', 'incident_postmortem.docx'],
  image: ['whiteboard_2024_03_11.jpg', 'scan_signed_page_7.png', 'rack_diagram_photo.heic'],
  audio: ['voice_memo_0912.m4a', 'client_call_recording.wav', 'standup_2026_02.m4a'],
  pdf: ['meridian_msa_executed.pdf', 'audit_findings_2025.pdf', 'vendor_dpa_countersigned.pdf'],
  email: ['re: Meridian redlines', 'FW: FW: FW: pricing', 're: retention window — legal'],
  sheet: ['contract_terms_tracker.xlsx', 'headcount_plan_v11.xlsx', 'risk_register.xlsx'],
  slack: ['#incidents — 3,401 msgs', '#legal-private — restricted', '#eng — pinned: the runbook'],
}

export function labelFor(kind: ArtifactKind, variant: number): string {
  return LABELS[kind][variant % LABELS[kind].length]
}
