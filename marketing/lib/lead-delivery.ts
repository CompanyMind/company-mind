/**
 * Where a design-partner enquiry actually goes.
 *
 * Split out of the route so it can be tested. The route's job is parsing and
 * validating an HTTP request; this module's job is getting the lead to a human.
 * The contact page is the one page on this site where losing a submission costs
 * real money, so this is the piece that most needs a test around it.
 *
 * TWO DESTINATIONS, IN PRIORITY ORDER
 *
 * 1. `RESEND_API_KEY` + `LEAD_EMAIL_TO` — the enquiry arrives as an email.
 *    Chosen because the reply happens in email regardless: the contact page's
 *    own fallback is a `mailto:`, so any other destination would just mean
 *    copying the lead into the place the answer gets written anyway. The email
 *    sets `reply_to` to the enquirer, so replying is one keystroke and the
 *    thread starts in the right place.
 * 2. `WAITLIST_WEBHOOK_URL` — the original generic JSON POST, kept working so
 *    a Zapier/Make hook or a CRM intake is still a config change and not a code
 *    change. Used only when no Resend key is set.
 *
 * NEITHER CONFIGURED IS A FAILURE, DELIBERATELY. The alternative is logging the
 * lead to stdout and answering "Received. We will be in touch shortly." That
 * sentence would be false — container stdout is not storage — and a site whose
 * entire job is recruiting design partners must not thank someone while
 * dropping them. Failing closed shows the form's error state, which hands over
 * a real mailto address, so the person still reaches a human.
 *
 * No SDK. Resend's send endpoint is one POST, and adding a dependency to make
 * one HTTP call would bake a vendor into the build for no benefit.
 */

export type Lead = {
  email: string
  company: string
  role: string
  scattered: string
}

/**
 * `not-configured` and `failed` are distinct because they need different
 * operator responses — one is "you never finished setup", the other is "your
 * provider is down or rejecting you" — and the log line says which.
 */
export type DeliveryResult = 'delivered' | 'not-configured' | 'failed'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 8000

/**
 * Resend permits sending from this address with no DNS setup at all, to the
 * address the account was registered with. That is exactly the position a new
 * account is in, so it is the default — lead capture starts working the moment
 * an API key exists, with no waiting on DNS propagation. Override with
 * `LEAD_EMAIL_FROM` once `companymind.uz` is verified, to send from a branded
 * address that will also land better in spam filters.
 */
const DEFAULT_FROM = 'CompanyMind <onboarding@resend.dev>'

/** A stable, scannable subject: who it is from, at a glance, in an inbox. */
export function subjectFor(lead: Lead): string {
  const who = lead.company.trim() || lead.email
  return `CompanyMind enquiry — ${who}`
}

/**
 * Plain text, not HTML. It is read by one person who is about to reply to it;
 * every field is shown even when empty, because "Role: (not given)" tells the
 * reader the question was asked and skipped, while omitting the line entirely
 * looks like the form never asked.
 */
export function bodyFor(lead: Lead, locale: string, at: string): string {
  const or = (v: string) => v.trim() || '(not given)'
  return [
    `From:     ${lead.email}`,
    `Company:  ${or(lead.company)}`,
    `Role:     ${or(lead.role)}`,
    `Language: ${locale}`,
    `Received: ${at}`,
    '',
    'Where their knowledge is scattered today:',
    or(lead.scattered),
    '',
    '—',
    'Reply directly to this email to reach them.',
  ].join('\n')
}

type Deps = {
  fetch?: typeof fetch
  env?: Record<string, string | undefined>
  now?: () => string
}

export async function deliverLead(
  lead: Lead,
  locale: string,
  deps: Deps = {},
): Promise<DeliveryResult> {
  const doFetch = deps.fetch ?? fetch
  const env = deps.env ?? process.env
  const at = deps.now ? deps.now() : new Date().toISOString()

  const apiKey = env.RESEND_API_KEY
  const to = env.LEAD_EMAIL_TO
  const webhook = env.WAITLIST_WEBHOOK_URL

  if (apiKey && to) {
    try {
      const res = await doFetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.LEAD_EMAIL_FROM || DEFAULT_FROM,
          to: [to],
          subject: subjectFor(lead),
          text: bodyFor(lead, locale, at),
          // The whole point: hitting Reply answers the person who wrote in,
          // not the sending address.
          reply_to: lead.email,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) {
        // The body carries Resend's reason (unverified domain, bad key, a `to`
        // that is not the account address on the free tier). Without it the
        // operator is debugging blind.
        const detail = await res.text().catch(() => '')
        console.error(`[waitlist] Resend responded ${res.status}: ${detail.slice(0, 500)}`)
        return 'failed'
      }
      return 'delivered'
    } catch (err) {
      console.error('[waitlist] Resend delivery failed:', err)
      return 'failed'
    }
  }

  // A key with no recipient (or the reverse) is a half-finished setup, and
  // silently falling through to the webhook would hide it.
  if (apiKey && !to) {
    console.error('[waitlist] RESEND_API_KEY is set but LEAD_EMAIL_TO is not — cannot deliver.')
    return 'not-configured'
  }
  if (to && !apiKey && !webhook) {
    console.error('[waitlist] LEAD_EMAIL_TO is set but RESEND_API_KEY is not — cannot deliver.')
    return 'not-configured'
  }

  if (webhook) {
    try {
      const res = await doFetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `locale` rides along because it is the single most useful thing to
        // know before replying: the language the person chose to read us in.
        body: JSON.stringify({ ...lead, locale, at, source: 'companymind-site' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) {
        console.error(`[waitlist] webhook responded ${res.status}`)
        return 'failed'
      }
      return 'delivered'
    } catch (err) {
      console.error('[waitlist] webhook delivery failed:', err)
      return 'failed'
    }
  }

  return 'not-configured'
}
