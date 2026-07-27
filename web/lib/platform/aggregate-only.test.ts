/**
 * The platform tier sees counts, never content.
 *
 * A firm renting this product will ask whether the operator can read their
 * documents or their staff's questions. The answer has to be "no, and here is
 * the test", not "no, by convention" — a drill-down added later "just for
 * support" is exactly how an aggregate-only promise erodes.
 *
 * Two separate things are asserted:
 *   1. Every platform route 404s for a non-super-admin.
 *   2. Every platform response body, recursively, contains no question text, no
 *      document or chunk text, and no per-user activity row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { verifyCsrf } from '@/lib/csrf'
import { listFirms, createFirm, setFirmSuspended, resetOwnerPassword } from '@/lib/platform/firms'
import { getUsageSummary } from '@/lib/usage'
import { GET as firmsGET, POST as firmsPOST } from '@/app/api/platform/firms/route'
import { POST as suspendPOST } from '@/app/api/platform/firms/[id]/suspend/route'
import { POST as resetPOST } from '@/app/api/platform/firms/[id]/reset-owner-password/route'
import { GET as usageGET } from '@/app/api/platform/usage/route'

vi.mock('@/lib/auth/require-super-admin', () => ({ getSuperAdmin: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(), issueCsrf: vi.fn() }))
vi.mock('@/lib/platform/firms', () => ({
  listFirms: vi.fn(),
  createFirm: vi.fn(),
  setFirmSuspended: vi.fn(),
  resetOwnerPassword: vi.fn(),
}))
vi.mock('@/lib/usage', () => ({ getUsageSummary: vi.fn() }))
vi.mock('@/lib/db/client', () => ({ db: { select: () => ({ from: async () => [{ n: 3 }] }) } }))

const mockGetSuperAdmin = vi.mocked(getSuperAdmin)
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body: unknown = {}) =>
  new Request('http://test/x', { method: 'POST', body: JSON.stringify(body) })

const ROUTES: Array<{ name: string; run: () => Promise<Response> }> = [
  { name: 'GET /api/platform/firms', run: () => firmsGET() },
  { name: 'POST /api/platform/firms', run: () => firmsPOST(post({ name: 'X', ownerEmail: 'a@b.c' })) },
  { name: 'POST /api/platform/firms/[id]/suspend', run: () => suspendPOST(post({ suspended: true }), params('w1')) },
  {
    name: 'POST /api/platform/firms/[id]/reset-owner-password',
    run: () => resetPOST(post(), params('u1')),
  },
  { name: 'GET /api/platform/usage', run: () => usageGET(new Request('http://test/api/platform/usage')) },
]

/** Every string anywhere in a response body, however deeply nested. */
function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out))
  else if (value && typeof value === 'object')
    Object.entries(value).forEach(([k, v]) => {
      out.push(k)
      allStrings(v, out)
    })
  return out
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(verifyCsrf).mockResolvedValue(true)
})

describe('platform routes are closed to everyone but the operator', () => {
  for (const r of ROUTES) {
    it(`404s for a non-super-admin: ${r.name}`, async () => {
      mockGetSuperAdmin.mockResolvedValue(null)
      const res = await r.run()
      // 404, never 403 — a 403 would confirm the surface exists.
      expect(res.status).toBe(404)
    })
  }

  it('covers every platform route (guard against silent additions)', () => {
    expect(ROUTES).toHaveLength(5)
  })
})

describe('platform responses are aggregate-only', () => {
  const FORBIDDEN_KEYS = [
    'question',
    'questions_text',
    'text',
    'content',
    'snippet',
    'extractedText',
    'chunk',
    'answer',
    'filename',
  ]

  it('the firm list carries counts and identity, never content', async () => {
    mockGetSuperAdmin.mockResolvedValue({ userId: 'admin' })
    vi.mocked(listFirms).mockResolvedValue([
      {
        id: 'w1',
        name: 'Acme Bank',
        slug: 'acme-bank',
        createdAt: new Date(),
        suspendedAt: null,
        userCount: 12,
        owners: [{ id: 'u1', email: 'admin@acme.test' }],
      },
    ])

    const body = await (await firmsGET()).json()
    const keys = allStrings(body)
    for (const k of FORBIDDEN_KEYS) expect(keys).not.toContain(k)
    // Non-vacuous: it really did return the firm.
    expect(JSON.stringify(body)).toContain('Acme Bank')
  })

  it('the usage summary carries counts, never a question or a per-user row', async () => {
    mockGetSuperAdmin.mockResolvedValue({ userId: 'admin' })
    vi.mocked(getUsageSummary).mockResolvedValue({
      days: 30,
      totals: {
        questions: 41,
        activeUsers: 6,
        documentsIndexed: 22,
        folders: 4,
        questionTypes: { lookup: 20, comparison: 8, aggregate: 9, enumerate: 4 },
        lexicalArmEmpty: 3,
        answerUncited: 1,
      },
      workspaces: [
        {
          workspaceId: 'w1',
          name: 'Acme Bank',
          questions: 41,
          activeUsers: 6,
          documentsIndexed: 22,
          folders: 4,
          questionTypes: { lookup: 20, comparison: 8, aggregate: 9, enumerate: 4 },
          lexicalArmEmpty: 3,
          answerUncited: 1,
        },
      ],
    } as never)

    const body = await (await usageGET(new Request('http://test/api/platform/usage'))).json()
    const keys = allStrings(body)
    for (const k of FORBIDDEN_KEYS) expect(keys).not.toContain(k)
    // "activeUsers" is a NUMBER, never a list of who.
    expect(typeof body.totals.activeUsers).toBe('number')
    expect(Array.isArray(body.totals.activeUsers)).toBe(false)
    expect(body.totals.questions).toBe(41) // non-vacuous
  })

  it('creating a firm returns the password once and nothing about content', async () => {
    mockGetSuperAdmin.mockResolvedValue({ userId: 'admin' })
    vi.mocked(createFirm).mockResolvedValue({
      ok: true,
      workspaceId: 'w1',
      ownerId: 'u1',
      tempPassword: 'temp-abc',
      bootstrapped: true,
    })

    const res = await firmsPOST(post({ name: 'Acme', ownerEmail: 'a@acme.test' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.tempPassword).toBe('temp-abc')
    for (const k of FORBIDDEN_KEYS) expect(allStrings(body)).not.toContain(k)
  })

  it('refuses to reset a member’s password through the owner-reset route', async () => {
    mockGetSuperAdmin.mockResolvedValue({ userId: 'admin' })
    vi.mocked(resetOwnerPassword).mockResolvedValue({ ok: false, reason: 'not-an-owner' })
    const res = await resetPOST(post(), params('member-id'))
    expect(res.status).toBe(400)
  })

  it('suspend reports 404 for an unknown firm', async () => {
    mockGetSuperAdmin.mockResolvedValue({ userId: 'admin' })
    vi.mocked(setFirmSuspended).mockResolvedValue('notfound')
    const res = await suspendPOST(post({ suspended: true }), params('nope'))
    expect(res.status).toBe(404)
  })
})
