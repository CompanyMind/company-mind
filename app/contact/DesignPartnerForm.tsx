'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MagneticButton } from '@/components/MagneticButton'
import { contactForm } from '@/content/contact'
import { cn } from '@/lib/cn'

/**
 * The design-partner form.
 *
 * Lives beside the route rather than in components/ because nothing else on the
 * site uses it, and page.tsx cannot hold it directly: that file exports
 * `metadata`, which makes it a Server Component, and this needs a client
 * boundary.
 *
 * Progressive enhancement, in order of how much the browser is helping:
 *  - No JS at all: it is a real <form method="post" action="/api/waitlist">.
 *    Native `required` + type="email" validate it, the route answers a native
 *    post with a 303 back to /contact?sent=1|0, and the server renders the
 *    outcome through `initialStatus`. It works.
 *  - JS: we take over with `noValidate` (set only once we are mounted, so the
 *    no-JS path keeps native validation) and post JSON, which lets us own the
 *    error copy and wire it to the field with aria-describedby.
 *  - Either way, the mailto fallback is on screen permanently. Nobody who wants
 *    to reach us is ever left holding a form that will not send.
 *
 * No localStorage, no sessionStorage. Nothing about a stranger's employer is
 * getting cached in their browser by us.
 */

export type FormStatus = 'idle' | 'sending' | 'sent' | 'failed'

/** Permissive on purpose. The real validation is a reply that arrives. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const f = contactForm
const MAILTO = `mailto:${f.fallback.address}?subject=${encodeURIComponent(f.fallback.subject)}`

const inputStyles = cn(
  'w-full rounded-lg border bg-paper px-4 py-3 font-body text-[0.9375rem] text-ink',
  // Placeholders sit at --ink-soft, which passes AA. They read as examples
  // rather than values because a filled field is --ink at ~15:1 next to them.
  'placeholder:text-ink-soft',
  'transition-colors duration-200 ease-paper',
)

function Field({
  id,
  label,
  hint,
  hintId,
  children,
}: {
  id: string
  label: string
  hint: string
  hintId: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="mono-label text-ink">
        {label}
      </label>
      <p id={hintId} className="text-[0.8125rem] leading-snug text-ink-soft">
        {hint}
      </p>
      <div className="pt-1">{children}</div>
    </div>
  )
}

export function DesignPartnerForm({ initialStatus = 'idle' }: { initialStatus?: FormStatus }) {
  const uid = useId()
  const emailId = `${uid}-email`
  const emailHintId = `${uid}-email-hint`
  const emailErrorId = `${uid}-email-error`
  const companyId = `${uid}-company`
  const companyHintId = `${uid}-company-hint`
  const roleId = `${uid}-role`
  const roleHintId = `${uid}-role-hint`
  const scatteredId = `${uid}-scattered`
  const scatteredHintId = `${uid}-scattered-hint`

  const formRef = useRef<HTMLFormElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<FormStatus>(initialStatus)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Submitting swaps the form out for the success panel, unmounting the button
  // that holds focus. Without this, focus falls back to <body> and a keyboard
  // or screen-reader user is silently returned to the top of the page with no
  // idea whether their enquiry sent. Move them to the confirmation instead.
  useEffect(() => {
    if (status === 'sent') successRef.current?.focus()
  }, [status])

  // Take validation off the browser only once JS is provably running, so the
  // no-JS render keeps native required/type=email as its safety net. Written
  // straight to the DOM rather than held in state: this is a one-way sync to an
  // external system, and routing it through a re-render would buy nothing.
  useEffect(() => {
    if (formRef.current) formRef.current.noValidate = true
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()

    if (!email || !EMAIL.test(email)) {
      setEmailError(email ? f.errors.emailInvalid : f.errors.emailRequired)
      // Move the user to the problem. The message is wired via
      // aria-describedby, so focusing the input announces it.
      emailRef.current?.focus()
      return
    }

    setEmailError(null)
    setStatus('sending')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          company: String(data.get('company') ?? '').trim(),
          role: String(data.get('role') ?? '').trim(),
          scattered: String(data.get('scattered') ?? '').trim(),
        }),
      })
      if (!res.ok) throw new Error(`waitlist responded ${res.status}`)
      form.reset()
      setStatus('sent')
    } catch {
      // Never swallow this into a fake success. The failure panel below hands
      // them a working address instead.
      setStatus('failed')
    }
  }

  if (status === 'sent') {
    return (
      <div
        ref={successRef}
        role="status"
        // tabIndex -1 + the focus effect below: submitting unmounts the whole
        // form, including the button that currently HAS focus, which dumps
        // keyboard and screen-reader users back at <body> — top of the page,
        // no idea whether it worked. role="status" announces the text, but
        // only focus actually moves them here.
        tabIndex={-1}
        className="rounded-2xl border border-line bg-paper-raised p-6 shadow-card outline-none sm:p-8"
      >
        <h2 className="font-display text-display-sm text-ink">{f.success.title}</h2>
        <p className="mt-3 max-w-measure text-[0.9375rem] leading-relaxed text-ink-soft">
          {f.success.body}
        </p>
        <p className="mt-6 border-t border-line pt-5 text-[0.8125rem] text-ink-soft">
          {f.fallback.lead}{' '}
          <a href={MAILTO} className="text-ink underline decoration-line underline-offset-4">
            {f.fallback.address}
          </a>
        </p>
      </div>
    )
  }

  const sending = status === 'sending'

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6 shadow-card sm:p-8">
      <h2 id={`${uid}-title`} className="font-display text-display-sm text-ink">
        {f.title}
      </h2>
      <p className="mt-2 text-[0.8125rem] text-ink-soft">{f.intro}</p>

      {status === 'failed' && (
        <div
          role="alert"
          /* --sovereign is the rarest ink in the system. It appears on this
             page in exactly one situation: something is wrong. That is the
             whole point of keeping it rare. */
          className="mt-6 rounded-lg border border-sovereign-text bg-paper-sunk p-4"
        >
          <p className="font-mono text-telemetry uppercase tracking-[0.1em] text-sovereign-text">
            {f.failure.title}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-snug text-ink">
            {f.failure.body}{' '}
            <a
              href={MAILTO}
              className="whitespace-nowrap font-medium text-ink underline decoration-ink-soft underline-offset-4"
            >
              {f.fallback.address}
            </a>
          </p>
        </div>
      )}

      <form
        ref={formRef}
        method="post"
        action="/api/waitlist"
        onSubmit={onSubmit}
        aria-labelledby={`${uid}-title`}
        className="mt-7 flex flex-col gap-6"
      >
        <Field
          id={emailId}
          label={f.fields.email.label}
          hint={f.fields.email.hint}
          hintId={emailHintId}
        >
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder={f.fields.email.placeholder}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${emailHintId} ${emailErrorId}` : emailHintId}
            onChange={() => emailError && setEmailError(null)}
            className={cn(
              inputStyles,
              emailError ? 'border-sovereign-text' : 'border-line-control hover:border-ink',
            )}
          />
          {emailError && (
            <p id={emailErrorId} className="mt-2 text-[0.8125rem] leading-snug text-sovereign-text">
              {emailError}
            </p>
          )}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id={companyId}
            label={f.fields.company.label}
            hint={f.fields.company.hint}
            hintId={companyHintId}
          >
            <input
              id={companyId}
              name="company"
              type="text"
              autoComplete="organization"
              placeholder={f.fields.company.placeholder}
              aria-describedby={companyHintId}
              className={cn(inputStyles, 'border-line-control hover:border-ink')}
            />
          </Field>

          <Field
            id={roleId}
            label={f.fields.role.label}
            hint={f.fields.role.hint}
            hintId={roleHintId}
          >
            <input
              id={roleId}
              name="role"
              type="text"
              autoComplete="organization-title"
              placeholder={f.fields.role.placeholder}
              aria-describedby={roleHintId}
              className={cn(inputStyles, 'border-line-control hover:border-ink')}
            />
          </Field>
        </div>

        <Field
          id={scatteredId}
          label={f.fields.scattered.label}
          hint={f.fields.scattered.hint}
          hintId={scatteredHintId}
        >
          <textarea
            id={scatteredId}
            name="scattered"
            rows={4}
            placeholder={f.fields.scattered.placeholder}
            aria-describedby={scatteredHintId}
            className={cn(inputStyles, 'resize-y border-line-control hover:border-ink')}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
          <MagneticButton type="submit" variant="ink" disabled={sending}>
            {sending ? f.sending : f.submit}
          </MagneticButton>
          <p className="text-[0.8125rem] text-ink-soft">
            {f.fallback.lead}{' '}
            <a href={MAILTO} className="text-ink underline decoration-line underline-offset-4">
              {f.fallback.address}
            </a>
          </p>
        </div>
      </form>
    </div>
  )
}
