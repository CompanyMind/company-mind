import type { Config } from 'tailwindcss'

/**
 * Tailwind reads every color from the CSS custom properties in styles/tokens.css
 * so that Tailwind classes and the canvas swarm can never drift apart.
 *
 * Note: because these resolve to hex via var(), Tailwind's slash-opacity
 * modifiers (e.g. bg-paper/50) do NOT work on brand colors. That is deliberate —
 * use color-mix() in CSS when translucency is genuinely needed. Baking alpha
 * channels into the token layer would double every token for little gain.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './content/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: 'var(--paper)',
          raised: 'var(--paper-raised)',
          sunk: 'var(--paper-sunk)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
        },
        line: {
          DEFAULT: 'var(--line)',
          // For form-control borders. See the note in styles/tokens.css:
          // `line` measures 1.45 on paper-raised and fails WCAG SC 1.4.11.
          control: 'var(--line-control)',
        },
        brain: {
          DEFAULT: 'var(--brain)',
          text: 'var(--brain-text)',
        },
        query: {
          DEFAULT: 'var(--query)',
          text: 'var(--query-text)',
        },
        sovereign: {
          DEFAULT: 'var(--sovereign)',
          text: 'var(--sovereign-text)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Display scale — fluid, tight-tracked. The headline IS the design.
        //
        // Sized against the REAL headlines, not in the abstract. The hero runs
        // to three lines ("Everything your / company knows. / Behind your own
        // walls."), and its longest line is ~22 characters. At the original
        // 9.5rem cap that line measured ~1160px against ~1150px of usable
        // shell — it overflowed, and the third line fell below the fold.
        // 5.5rem keeps it confident AND on screen at 1440x900.
        'display-xl': ['clamp(2.25rem, 6.2vw, 5.5rem)', { lineHeight: '0.9', letterSpacing: '-0.04em' }],
        'display-lg': ['clamp(2rem, 5vw, 4.25rem)', { lineHeight: '0.92', letterSpacing: '-0.035em' }],
        'display-md': ['clamp(1.75rem, 3.6vw, 3rem)', { lineHeight: '0.98', letterSpacing: '-0.03em' }],
        'display-sm': ['clamp(1.25rem, 2.2vw, 1.75rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        // Mono telemetry — small, wide-tracked, deliberate.
        telemetry: ['0.6875rem', { lineHeight: '1.5', letterSpacing: '0.06em' }],
        label: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.14em' }],
      },
      boxShadow: {
        artifact: 'var(--shadow-artifact)',
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
      },
      maxWidth: {
        measure: 'var(--measure)',
        shell: '82rem',
      },
      transitionTimingFunction: {
        paper: 'var(--ease-out-paper)',
        'paper-in-out': 'var(--ease-in-out-paper)',
      },
      keyframes: {
        'mask-up': {
          from: { transform: 'translateY(110%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        heartbeat: {
          '0%, 100%': { opacity: '0.25' },
          '8%': { opacity: '1' },
          '20%': { opacity: '0.4' },
          '28%': { opacity: '0.8' },
        },
      },
      animation: {
        'mask-up': 'mask-up 0.9s var(--ease-out-paper) both',
        'fade-in': 'fade-in 0.6s var(--ease-out-paper) both',
        heartbeat: 'heartbeat 3.2s var(--ease-in-out-paper) infinite',
      },
    },
  },
  plugins: [],
}

export default config
