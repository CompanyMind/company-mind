import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deliverLead, subjectFor, bodyFor, type Lead } from './lead-delivery'

/**
 * The contact form is the one page on this site where a dropped submission
 * costs real money, and it has now shipped broken twice — once delivering
 * nowhere at all, once redirecting to a Docker hostname. These are the
 * properties that must not regress a third time.
 */
const LEAD: Lead = {
  email: 'aziz@bank.uz',
  company: 'Ipak Yuli Bank',
  role: 'Head of Compliance',
  scattered: 'Policies live in three shared drives and a Telegram channel.',
}

const AT = '2026-07-28T10:00:00.000Z'
const now = () => AT

function okResponse(): Response {
  return { ok: true, status: 200, text: async () => '' } as Response
}
function errResponse(status: number, body = 'nope'): Response {
  return { ok: false, status, text: async () => body } as Response
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('nothing configured', () => {
  it('reports not-configured rather than pretending to deliver', async () => {
    const fetchMock = vi.fn()
    const result = await deliverLead(LEAD, 'uz', { fetch: fetchMock, env: {}, now })
    expect(result).toBe('not-configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats a half-finished setup as not-configured, not as a silent fallthrough', async () => {
    const fetchMock = vi.fn()
    expect(
      await deliverLead(LEAD, 'uz', { fetch: fetchMock, env: { RESEND_API_KEY: 'k' }, now }),
    ).toBe('not-configured')
    expect(
      await deliverLead(LEAD, 'uz', { fetch: fetchMock, env: { LEAD_EMAIL_TO: 'a@b.c' }, now }),
    ).toBe('not-configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('email delivery (Resend)', () => {
  const env = {
    RESEND_API_KEY: 'test-key',
    LEAD_EMAIL_TO: 'dovudasadoff@gmail.com',
  }

  it('sends to the configured address, authenticated, with the lead as reply-to', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    const result = await deliverLead(LEAD, 'uz', { fetch: fetchMock, env, now })

    expect(result).toBe('delivered')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer test-key')

    const body = JSON.parse(init.body)
    expect(body.to).toEqual(['dovudasadoff@gmail.com'])
    // The single most valuable field: Reply goes to the enquirer, so the
    // thread starts in the right place instead of being answered by hand.
    expect(body.reply_to).toBe('aziz@bank.uz')
  })

  it('defaults to a From that works before any DNS is set up', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    await deliverLead(LEAD, 'uz', { fetch: fetchMock, env, now })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    // Resend allows this sender with no domain verification, so lead capture
    // works the moment a key exists rather than after DNS propagates.
    expect(body.from).toContain('onboarding@resend.dev')
  })

  it('honours LEAD_EMAIL_FROM once the domain is verified', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    await deliverLead(LEAD, 'uz', {
      fetch: fetchMock,
      env: { ...env, LEAD_EMAIL_FROM: 'CompanyMind <hello@companymind.uz>' },
      now,
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.from).toBe('CompanyMind <hello@companymind.uz>')
  })

  it('carries every field the reader needs to answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    await deliverLead(LEAD, 'uz', { fetch: fetchMock, env, now })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(body.subject).toContain('Ipak Yuli Bank')
    for (const fragment of [
      'aziz@bank.uz',
      'Ipak Yuli Bank',
      'Head of Compliance',
      'uz',
      AT,
      'three shared drives',
    ]) {
      expect(body.text).toContain(fragment)
    }
  })

  it('reports failure — never "delivered" — when Resend rejects it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errResponse(403, 'domain not verified'))
    expect(await deliverLead(LEAD, 'uz', { fetch: fetchMock, env, now })).toBe('failed')
    // The reason has to reach the operator or they debug blind.
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('domain not verified'))
  })

  it('reports failure when the network throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    expect(await deliverLead(LEAD, 'uz', { fetch: fetchMock, env, now })).toBe('failed')
  })

  it('prefers email over a webhook when both are configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    await deliverLead(LEAD, 'uz', {
      fetch: fetchMock,
      env: { ...env, WAITLIST_WEBHOOK_URL: 'https://hooks.example/x' },
      now,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails')
  })
})

describe('webhook delivery (still supported)', () => {
  const env = { WAITLIST_WEBHOOK_URL: 'https://hooks.example/x' }

  it('POSTs the lead as JSON, with locale and source', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    expect(await deliverLead(LEAD, 'ru', { fetch: fetchMock, env, now })).toBe('delivered')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://hooks.example/x')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      email: 'aziz@bank.uz',
      locale: 'ru',
      at: AT,
      source: 'companymind-site',
    })
  })

  it('reports failure on a non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errResponse(500))
    expect(await deliverLead(LEAD, 'uz', { fetch: fetchMock, env, now })).toBe('failed')
  })
})

describe('formatting', () => {
  it('falls back to the email address when no company was given', () => {
    expect(subjectFor({ ...LEAD, company: '' })).toContain('aziz@bank.uz')
  })

  it('shows a skipped field as skipped rather than omitting the line', () => {
    // Omitting it entirely reads as "the form never asked".
    const text = bodyFor({ ...LEAD, role: '' }, 'uz', AT)
    expect(text).toContain('Role:')
    expect(text).toContain('(not given)')
  })
})
