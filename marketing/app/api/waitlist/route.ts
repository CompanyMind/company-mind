import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, localePath, type Locale } from '@/i18n/config'
import { deliverLead, type Lead } from '@/lib/lead-delivery'

/**
 * ============================================================================
 * POST /api/waitlist — design-partner enquiries
 * ============================================================================
 *
 * WHAT THIS IS
 * The lead path. It validates the shape of an enquiry and hands it to
 * `lib/lead-delivery.ts`, which emails it (Resend) or POSTs it to a webhook.
 * This is the one page on the site where losing a submission costs real money,
 * so the delivery half is a separate, tested module rather than inline code.
 *
 * IT FAILS CLOSED, ON PURPOSE.
 * With no destination configured in production the route answers 503 and the
 * form shows its error state with a real mailto. The alternative — logging the
 * lead and replying "Received. We will be in touch shortly." — would be a false
 * sentence, because container stdout is not storage. A site whose entire job is
 * recruiting design partners must not thank someone while dropping them.
 *
 * SECRETS DO NOT BELONG IN THIS REPO
 * No API key, token, or webhook URL is ever committed. They are read from
 * `process.env` at request time — server-side only, never a NEXT_PUBLIC_* name,
 * which would inline the value into the client bundle for the whole internet.
 * Set them in the host's environment and keep every .env* file out of git.
 *
 * STILL MISSING, DELIBERATELY
 *   - Rate limiting and spam control. This endpoint is open to the internet,
 *     and is the next thing to add if it is ever found by a bot.
 *   - Retries and dedupe. A failed send is surfaced to the person, who still
 *     has the mailto, rather than queued.
 *
 * TWO CALLERS, ONE HANDLER
 *   - fetch() with Content-Type: application/json → JSON in, JSON out. This is
 *     the documented contract: { ok: true } on success, 400 on a bad payload.
 *   - A native <form> POST (JavaScript disabled or still loading) → form-encoded
 *     in, 303 redirect back to /<locale>/contact?sent=1|0 out, because a browser
 *     doing a top-level navigation would otherwise render raw JSON at the user.
 *     Locked-down enterprise browsers are exactly our audience, so this path is
 *     not hypothetical — and it is the one that was broken until 2026-07-28,
 *     see redirectToContact below.
 *
 * THE ROUTE IS NOT UNDER [locale] AND MUST NOT BE.
 * `/api/waitlist` is one endpoint, not three, and `proxy.ts` excludes `/api`
 * from locale prefixing for that reason. The consequence is that it cannot read
 * a locale from the URL, so both callers send one in the body — see
 * `localeFrom`, which validates it before it is ever put in a redirect.
 * ============================================================================
 */

/** Node runtime: delivery makes an outbound HTTPS call with a server-side key. */
export const runtime = 'nodejs'
/** A form submission is never cached or prerendered. */
export const dynamic = 'force-dynamic'

/** Deliberately permissive. Real address validation is a reply that arrives. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Caps every field so a hostile POST cannot fill the log with a novel. */
const LIMITS = { email: 254, company: 200, role: 200, scattered: 4000 } as const

function field(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isFormPost(request: NextRequest): boolean {
  const type = request.headers.get('content-type') ?? ''
  return type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')
}

/**
 * The language the enquiry came from. Sent as a hidden field by the form and in
 * the JSON body by the homepage CTA, because this route is not under `[locale]`
 * and therefore has no locale segment of its own to read.
 *
 * VALIDATED, NEVER TRUSTED: it lands in a redirect URL, so an unchecked value
 * would let a crafted POST bounce a visitor to any path on the site. Anything
 * that is not one of the three known locales falls back to the default.
 */
function localeFrom(raw: Record<string, unknown>): Locale {
  const value = raw.locale
  return typeof value === 'string' && isLocale(value) ? value : defaultLocale
}

/**
 * No-JS path: send the browser back to the page, which renders the outcome.
 *
 * The `Location` is RELATIVE and must stay that way. `request.url` in a route
 * handler is the server's own listening socket — in Docker, the container id
 * and internal port — not the `Host` header, which Next does not consult here.
 * This used to build an absolute URL from it and answered
 * `https://348ddc8da4cb:3001/uz/contact?sent=0`, a hostname that resolves only
 * inside the compose network. Every design-partner enquiry submitted without
 * JavaScript landed on a browser DNS error — on the one page of this site where
 * that costs actual money, and on exactly the path the header comment above
 * says is "not hypothetical" for locked-down enterprise browsers.
 *
 * RFC 7231 §7.1.2 permits a relative URI-reference in `Location`; the browser
 * resolves it against the URL it actually requested, which is the public one.
 * `localePath` always returns a rooted path, so this is unambiguous.
 * (Found alongside the identical bug in web's logout route, 2026-07-28.)
 */
function redirectToContact(_request: NextRequest, locale: Locale, ok: boolean) {
  const path = localePath(locale, '/contact')
  return new NextResponse(null, {
    status: 303,
    headers: { location: `${path}?sent=${ok ? '1' : '0'}` },
  })
}

export async function POST(request: NextRequest) {
  const fromForm = isFormPost(request)

  // ---- Parse -------------------------------------------------------------
  let raw: Record<string, unknown>
  try {
    if (fromForm) {
      raw = Object.fromEntries(await request.formData())
    } else {
      const parsed: unknown = await request.json()
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('body is not a JSON object')
      }
      raw = parsed as Record<string, unknown>
    }
  } catch {
    // The body never parsed, so there is no locale in it. The default is the
    // only honest guess, and it is a page that exists.
    if (fromForm) return redirectToContact(request, defaultLocale, false)
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 })
  }

  const locale = localeFrom(raw)

  // ---- Validate ----------------------------------------------------------
  const lead: Lead = {
    email: field(raw.email, LIMITS.email),
    company: field(raw.company, LIMITS.company),
    role: field(raw.role, LIMITS.role),
    scattered: field(raw.scattered, LIMITS.scattered),
  }

  if (!lead.email || !EMAIL.test(lead.email)) {
    if (fromForm) return redirectToContact(request, locale, false)
    return NextResponse.json(
      { ok: false, error: 'A valid email address is required.' },
      { status: 400 },
    )
  }

  // ---- DELIVERY ----------------------------------------------------------
  //
  // Destinations and their priority live in lib/lead-delivery.ts. Summary:
  // RESEND_API_KEY + LEAD_EMAIL_TO sends the enquiry as an email (the default —
  // the reply happens in email anyway), WAITLIST_WEBHOOK_URL is the generic
  // JSON POST fallback for a Zapier/Make hook or a CRM intake.
  //
  // IF NEITHER IS CONFIGURED IN PRODUCTION, THIS ROUTE FAILS ON PURPOSE.
  // The alternative is worse: logging the lead to stdout and answering
  // "Received. We will be in touch shortly." That sentence would be false —
  // container stdout is not storage — and a site whose entire job is recruiting
  // design partners must not quietly drop them while thanking them. Failing
  // closed shows the form's error state, which hands over a real mailto
  // address, so the person still reaches a human.
  const outcome = await deliverLead(lead, locale)

  if (outcome === 'not-configured') {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[waitlist] no delivery configured — refusing an enquiry we cannot deliver. ' +
          'Set RESEND_API_KEY + LEAD_EMAIL_TO (or WAITLIST_WEBHOOK_URL).',
      )
      if (fromForm) return redirectToContact(request, locale, false)
      return NextResponse.json({ ok: false, error: 'Delivery is not configured.' }, { status: 503 })
    }
    // Development: log and accept, so the form is testable with no setup.
    console.warn('[waitlist] dev — no delivery configured; logging instead:', {
      at: new Date().toISOString(),
      ...lead,
    })
    if (fromForm) return redirectToContact(request, locale, true)
    return NextResponse.json({ ok: true })
  }

  if (outcome === 'failed') {
    // Tell the truth on the way out: the form shows its failure state and the
    // mailto fallback, so the person still reaches us.
    if (fromForm) return redirectToContact(request, locale, false)
    return NextResponse.json({ ok: false, error: 'Delivery failed.' }, { status: 502 })
  }

  if (fromForm) return redirectToContact(request, locale, true)
  return NextResponse.json({ ok: true })
}
