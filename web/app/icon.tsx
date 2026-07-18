import { ImageResponse } from 'next/og'

/**
 * The favicon: the CompBrain mark from components/Wordmark.tsx — your walls,
 * and one organized brain inside them — teal on warm paper.
 *
 * Why this file and not a .ico: Next.js cannot GENERATE a `favicon`, only an
 * `icon`, and a `favicon.ico` sitting in app/ would outrank this route. The
 * scaffolded default has been deleted so this is the only mark the browser can
 * find.
 *
 * Same renderer constraints as opengraph-image.tsx: `next/og` is a flexbox
 * subset, no Tailwind, no CSS variables — the colors below are literal copies
 * of styles/tokens.css.
 *
 * The geometry is deliberately NOT a pixel-for-pixel copy of the 20px wordmark.
 * A tab icon gets downscaled to 16px, where 1.25px strokes and a 35%-opacity
 * perimeter turn to mud, so the strokes are thickened and the walls darkened
 * until the mark survives the shrink. It reads as the same mark; it is drawn
 * for a different size.
 */

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const PAPER = '#F3EEE3'
const BRAIN = '#0F8A7E'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: PAPER,
      }}
    >
      <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
        {/* the walls */}
        <rect
          x="1"
          y="1"
          width="18"
          height="18"
          rx="3.4"
          stroke="rgba(28, 27, 24, 0.5)"
          strokeWidth="1.4"
        />
        {/* the lattice within — three nodes, connected */}
        <path
          d="M6 13.8 L10 6.2 L14 13.8 M6 13.8 L14 13.8"
          stroke={BRAIN}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="6.2" r="1.5" fill={BRAIN} />
        <circle cx="6" cy="13.8" r="1.5" fill={BRAIN} />
        <circle cx="14" cy="13.8" r="1.5" fill={BRAIN} />
      </svg>
    </div>,
    { ...size },
  )
}
