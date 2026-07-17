import { NextResponse, type NextRequest } from 'next/server'

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
 *   - Email   → Resend / Postmark, send to hello@compbrain.ai
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
 *     in, 303 redirect back to /contact?sent=1|0 out, because a browser doing a
 *     top-level navigation would otherwise render raw JSON at the user. Locked-
 *     down enterprise browsers are exactly our audience, so this path is not
 *     hypothetical.
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

/** No-JS path: send the browser back to the page, which renders the outcome. */
function redirectToContact(request: NextRequest, ok: boolean) {
  return NextResponse.redirect(new URL(`/contact?sent=${ok ? '1' : '0'}`, request.url), 303)
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
    if (fromForm) return redirectToContact(request, false)
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 })
  }

  // ---- Validate ----------------------------------------------------------
  const lead: Lead = {
    email: field(raw.email, LIMITS.email),
    company: field(raw.company, LIMITS.company),
    role: field(raw.role, LIMITS.role),
    scattered: field(raw.scattered, LIMITS.scattered),
  }

  if (!lead.email || !EMAIL.test(lead.email)) {
    if (fromForm) return redirectToContact(request, false)
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
      if (fromForm) return redirectToContact(request, false)
      return NextResponse.json({ ok: false, error: 'Delivery is not configured.' }, { status: 503 })
    }
    // Development: log and accept, so the form is testable with no setup.
    console.warn('[waitlist] dev — no WAITLIST_WEBHOOK_URL; logging instead of delivering:', {
      at: new Date().toISOString(),
      ...lead,
    })
    if (fromForm) return redirectToContact(request, true)
    return NextResponse.json({ ok: true })
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, at: new Date().toISOString(), source: 'compbrain-site' }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`webhook responded ${res.status}`)
  } catch (err) {
    console.error('[waitlist] delivery failed:', err)
    if (fromForm) return redirectToContact(request, false)
    // Tell the truth on the way out: the form shows its failure state and the
    // mailto fallback, so the person still reaches us.
    return NextResponse.json({ ok: false, error: 'Delivery failed.' }, { status: 502 })
  }
  // ↑↑↑ REPLACE THIS BLOCK IF YOU WANT DELIVERY OTHER THAN A WEBHOOK ↑↑↑

  if (fromForm) return redirectToContact(request, true)
  return NextResponse.json({ ok: true })
}
