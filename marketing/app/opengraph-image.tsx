import { ImageResponse } from 'next/og'
import { hero, site, footer } from '@/content/site'

/**
 * The Open Graph card — the site's first impression, and usually the only frame
 * of it a buyer sees before deciding whether to click.
 *
 * It is the homepage's opening shot, held still: warm paper, a drawn perimeter,
 * the headline, and one line of telemetry proving the claim. No screenshot, no
 * logo soup, no gradient. Same restraint as the site.
 *
 * ---------------------------------------------------------------------------
 * CONSTRAINTS THIS FILE LIVES UNDER — read before editing:
 *
 *  1. `next/og` (satori) implements a FLEXBOX SUBSET of CSS. Every element with
 *     more than one child needs an explicit `display: 'flex'`. There is no
 *     block layout, no float, no grid.
 *  2. No Tailwind classes and no CSS custom properties reach this renderer — it
 *     never sees the stylesheet. The tokens below are therefore LITERAL copies
 *     of styles/tokens.css. If a token changes there, change it here too.
 *  3. No custom font is loaded on purpose: `ImageResponse` ships with a bundled
 *     default, and fetching Space Grotesk / IBM Plex Mono at build time would
 *     add a network dependency to every build. The trade-off is that the card
 *     is not literally set in the site's faces. See the note on TELEMETRY below.
 * ------------------------------------------------------------------------- */

export const alt = `${site.name} — ${site.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/* Literal copies of styles/tokens.css — see constraint 2 above. */
const PAPER = '#F3EEE3'
const INK = '#1C1B18'
const INK_SOFT = '#635E54'
const LINE = '#D8D0BE'
const BRAIN = '#684BFF' // violet: LINES AND SHAPES ONLY, never text (contrast law)

/** Where the walls are drawn, in px from each edge of the 1200x630 frame. */
const INSET = 36

/** Blueprint register marks, exactly as StaticBrain.tsx places them. */
const CORNERS: [number, number][] = [
  [INSET, INSET],
  [size.width - INSET, INSET],
  [INSET, size.height - INSET],
  [size.width - INSET, size.height - INSET],
]

const MARK = 9 // half-length of each register tick

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: '100%',
        height: '100%',
        background: PAPER,
      }}
    >
      {/*
          The walls, drawn once as a single SVG rather than as a stack of
          bordered divs: it is fewer nodes, and it is the same geometry the
          site's StaticBrain motif uses.
        */}
      <svg
        width={size.width}
        height={size.height}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <rect
          x={INSET}
          y={INSET}
          width={size.width - INSET * 2}
          height={size.height - INSET * 2}
          rx="4"
          fill="none"
          stroke={LINE}
          strokeWidth="1.5"
        />
        {CORNERS.map(([x, y]) => (
          <g key={`${x}-${y}`} stroke="rgba(99, 94, 84, 0.55)" strokeWidth="1.25">
            <line x1={x - MARK} y1={y} x2={x + MARK} y2={y} />
            <line x1={x} y1={y - MARK} x2={x} y2={y + MARK} />
          </g>
        ))}
      </svg>

      {/* Everything readable sits inside the walls. */}
      <div
        style={{
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '84px',
        }}
      >
        {/* The wordmark — the nested-squares mark from Wordmark.tsx / icon.svg. */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
            <rect
              x="4.5"
              y="4.5"
              width="23"
              height="23"
              rx="6.6"
              stroke="rgba(28, 27, 24, 0.35)"
              strokeWidth="2.2"
            />
            <rect x="10.2" y="10.2" width="11.6" height="11.6" rx="3.4" stroke={BRAIN} strokeWidth="1.6" />
            <rect x="13.6" y="13.6" width="4.8" height="4.8" rx="1.5" fill={BRAIN} />
          </svg>
          <div
            style={{
              marginLeft: 12,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: INK,
            }}
          >
            {site.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Teal earns its place here as a RULE — a shape, not text. */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 30 }}>
            <div style={{ display: 'flex', width: 44, height: 2, background: BRAIN }} />
            <div
              style={{
                marginLeft: 16,
                fontSize: 19,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: INK_SOFT,
              }}
            >
              {hero.eyebrow}
            </div>
          </div>

          {/*
              The hero headline, kept on the site's own line breaks so the card
              and the page open with an identical shape.
            */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {hero.headline.map((line) => (
              <div
                key={line}
                style={{
                  fontSize: 72,
                  fontWeight: 700,
                  letterSpacing: '-0.035em',
                  lineHeight: 1.1,
                  color: INK,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        {/*
            TELEMETRY. On the site this line is IBM Plex Mono; here the bundled
            font is not a mono face, so the mono READING is carried by wide
            letter-spacing and a teal tick instead. It is the same string the
            footer shows, and it is true by construction, not a metric.
          */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 8, height: 8, background: BRAIN }} />
            <div
              style={{
                marginLeft: 14,
                fontSize: 21,
                letterSpacing: '0.1em',
                color: INK_SOFT,
              }}
            >
              {footer.status}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 21, letterSpacing: '0.06em', color: INK_SOFT }}>
            {site.domain}
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  )
}
