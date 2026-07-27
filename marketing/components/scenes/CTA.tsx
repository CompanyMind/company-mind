'use client'

import { useState } from 'react'
import type { HomeCtaCopy } from '@/content/types'
import type { Locale } from '@/i18n/config'
import { DecodeText } from '@/components/DecodeText'
import { MagneticButton } from '@/components/MagneticButton'

/**
 * SCENE 9 — CTA.
 * Everything converges into one calm, secured core inside the perimeter, which
 * beats slowly in --sovereign. The brain watches the cursor here (engine lean
 * is at its highest in this scene).
 *
 * This is design-partner recruitment, not a waitlist: CompanyMind is pre-launch,
 * and asking regulated teams to "join the waitlist" for software that does not
 * ship yet would be the first dishonest thing on the page.
 *
 * --sovereign appears on the button. That is one of only two places it is
 * allowed to exist (here and the perimeter pulse) — it carries the sovereignty
 * idea and never decorates.
 */
export function CTA({ locale, copy }: { locale: Locale; copy: HomeCtaCopy }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `locale` is carried so the no-JS sibling on /contact and this handler
        // agree about which language to return the visitor to.
        body: JSON.stringify({ email, source: 'home-cta', locale }),
      })
      setState(res.ok ? 'ok' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <section data-scene="cta" className="relative z-10 py-[12vh] md:h-[160vh] md:py-0">
      <div className="flex items-center md:sticky md:top-0 md:h-dvh">
        <div className="shell">
          <p className="mono-label mb-6">{copy.label}</p>

          <div className="wash max-w-4xl">
            <h2
              className="font-display text-display-md text-ink"
              aria-label={copy.headline.join(' ')}
            >
              {copy.headline.map((line) => (
                <span key={line} className="mask-line">
                  <DecodeText as="span" text={line} className="block" />
                </span>
              ))}
            </h2>
          </div>

          <p className="plate mt-8 max-w-measure p-5 text-body text-ink-soft">{copy.body}</p>

          {state === 'ok' ? (
            <p role="status" className="mt-12 font-display text-display-sm text-brain-text">
              {copy.success}
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-12 max-w-xl">
              <label htmlFor="cta-email" className="mono-label">
                {copy.formLabel}
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="cta-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.formPlaceholder}
                  aria-describedby={state === 'error' ? 'cta-error' : 'cta-fineprint'}
                  aria-invalid={state === 'error'}
                  // border-line-control, not border-line: a form control's
                  // boundary needs >=3:1 (WCAG SC 1.4.11) and --line is 1.45.
                  className="flex-1 rounded-full border border-line-control bg-paper-raised px-5 py-3.5 font-mono text-telemetry text-ink outline-none transition-colors placeholder:text-ink-soft focus:border-ink"
                />
                <MagneticButton
                  type="submit"
                  variant="sovereign"
                  disabled={state === 'sending'}
                  className="shrink-0"
                >
                  {state === 'sending' ? copy.sending : copy.submit}
                </MagneticButton>
              </div>

              {state === 'error' && (
                <p id="cta-error" role="alert" className="mt-3 text-sm text-sovereign-text">
                  {copy.error}
                </p>
              )}
              <p id="cta-fineprint" className="mt-4 text-sm text-ink-soft">
                {copy.fineprint}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
