import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, localePath, type Locale } from '@/i18n/config'

/**
 * ============================================================================
 * PLACEHOLDER ENDPOINT — POST /api/waitlist
 * ============================================================================
 *
 * WHAT THIS IS
 * A stub. It validates the shape of a design-partner enquiry, prints it to the
 * server console, and returns { ok: true }. It STORES NOTHING. Restart the
 * process and the lead is gone. On a serverless host the log line may be the
 * only trace, and it will age out. Ship this as-is and you will lose real
 * leads from real buyers — this is the one page on the site where that costs
 * actual money.
 *
 * WHERE TO WIRE THE REAL THING
 * One place, marked `DELIVERY` below. Replace the console.log with whichever of
 * these you actually use:
 *   - CRM     → POST the lead to HubSpot / Attio / Pipedrive with a server-side key
 *   - Email   → Resend / Postmark, send to hello@companymind.ai
 *   - Store   → an insert into Postgres / Supabase / a sheet
 * Whatever you pick: `await` it, and let a thrown error fall through to the 502
 * below. The form's failure state and its mailto fallback are wired to that
 * response. An endpoint that returns { ok: true } after silently dropping the
 * lead tells the user "received" and is the worst possible outcome here.
 *
 * SECRETS DO NOT BELONG IN THIS REPO
 * No API key, token, or webhook URL is ever committed to this codebase. Read
 * them from `process.env` at request time — server-side only, never a
 * NEXT_PUBLIC_* name, since that inlines the value into the client bundle for
 * the whole internet. Set them in the host's environment settings and keep
 * every .env* file out of git.
 *
 * STILL MISSING, DELIBERATELY (it is a placeholder, not a product)
 *   - Rate limiting and spam control. This endpoint is open to the internet.
 *   - Persistence, retries, dedupe, notification.
 *   - The console.log below prints an email address into your platform logs.
 *     That is a PII trail in a third party's system. Delete the log when real
 *     delivery lands — do not keep it "just in case".
 *
 * TWO CALLERS, ONE HANDLER
 *   - fetch() with Content-Type: application/json → JSON in, JSON out. This is
 *     the documented contract: { ok: true } on success, 400 on a bad payload.
 *   - A native <form> POST (JavaScript disabled or still loading) → form-encoded
 *     in, 303 redirect back to /<locale>/contact?sent=1|0 out, because a browser
 *     doing a top-level navigation would otherwise render raw JSON at the user.
 *     Locked-down enterprise browsers are exactly our audience, so this path is
 *     not hypothetical.
 *
 * THE ROUTE IS NOT UNDER [locale] AND MUST NOT BE.
 * `/api/waitlist` is one endpoint, not three, and `proxy.ts` excludes `/api`
 * from locale prefixing for that reason. The consequence is that it cannot read
 * a locale from the URL, so both callers send one in the body — see
 * `localeFrom`, which validates it before it is ever put in a redirect.
 * ============================================================================
 */

/** Node runtime: the CRM/email SDK you drop in below will almost certainly want it. */
export const runtime = 'nodejs'
/** A form submission is never cached or prerendered. */
export const dynamic = 'force-dynamic'

/** Deliberately permissive. Real address validation is a reply that arrives. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Caps every field so a hostile POST cannot fill the log with a novel. */
const LIMITS = { email: 254, company: 200, role: 200, scattered: 4000 } as const

type Lead = { email: string; company: string; role: string; scattered: string }

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
  // Set WAITLIST_WEBHOOK_URL and every enquiry is POSTed there as JSON. Any
  // endpoint that accepts a JSON body works: a Zapier/Make catch hook, a Slack
  // incoming webhook, a CRM intake, your own server. No SDK, no secret in the
  // repo, no vendor decision baked into the code.
  //
  //   vercel env add WAITLIST_WEBHOOK_URL production
  //
  // IF IT IS UNSET IN PRODUCTION, THIS ROUTE FAILS ON PURPOSE.
  // The alternative is worse: logging the lead to stdout and answering "Received.
  // We will be in touch shortly." That sentence would be false — serverless
  // stdout is not storage, and the enquiry is gone at the next cold start. A
  // site whose entire job is recruiting design partners must not quietly drop
  // them while thanking them. Failing closed shows the form's error state, which
  // hands over a real mailto address, so the person still reaches you.
  //
  // ↓↓↓ REPLACE THIS BLOCK IF YOU WANT DELIVERY OTHER THAN A WEBHOOK ↓↓↓
  const webhook = process.env.WAITLIST_WEBHOOK_URL

  if (!webhook) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[waitlist] WAITLIST_WEBHOOK_URL is not set — refusing to accept an enquiry ' +
          'we cannot deliver. Set it, or replace this block with real delivery.',
      )
      if (fromForm) return redirectToContact(request, locale, false)
      return NextResponse.json({ ok: false, error: 'Delivery is not configured.' }, { status: 503 })
    }
    // Development: log and accept, so the form is testable with no setup.
    console.warn('[waitlist] dev — no WAITLIST_WEBHOOK_URL; logging instead of delivering:', {
      at: new Date().toISOString(),
      ...lead,
    })
    if (fromForm) return redirectToContact(request, locale, true)
    return NextResponse.json({ ok: true })
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `locale` rides along because it is the single most useful thing to know
      // before replying: it is the language the person chose to read us in.
      body: JSON.stringify({
        ...lead,
        locale,
        at: new Date().toISOString(),
        source: 'companymind-site',
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`webhook responded ${res.status}`)
  } catch (err) {
    console.error('[waitlist] delivery failed:', err)
    if (fromForm) return redirectToContact(request, locale, false)
    // Tell the truth on the way out: the form shows its failure state and the
    // mailto fallback, so the person still reaches us.
    return NextResponse.json({ ok: false, error: 'Delivery failed.' }, { status: 502 })
  }
  // ↑↑↑ REPLACE THIS BLOCK IF YOU WANT DELIVERY OTHER THAN A WEBHOOK ↑↑↑

  if (fromForm) return redirectToContact(request, locale, true)
  return NextResponse.json({ ok: true })
}
