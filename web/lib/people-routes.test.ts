/**
 * The /api/people routes: owner-gated, and the workspace always comes from the
 * session.
 *
 * The forged-body test is the important one. `lib/people-scoping.test.ts` proves
 * the lib layer refuses cross-firm targets; this proves the ROUTE never hands it
 * a foreign workspace in the first place.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { createPerson, listPeople, setPersonBlocked, resetPersonPassword } from '@/lib/people'
import { GET as peopleGET, POST as peoplePOST } from '@/app/api/people/route'
import { POST as blockPOST } from '@/app/api/people/[id]/block/route'
import { POST as resetPOST } from '@/app/api/people/[id]/reset-password/route'

vi.mock('@/lib/auth/require-owner', () => ({ getOwner: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(), issueCsrf: vi.fn() }))
vi.mock('@/lib/people', () => ({
  listPeople: vi.fn(),
  createPerson: vi.fn(),
  setPersonBlocked: vi.fn(),
  resetPersonPassword: vi.fn(),
}))

const mockGetOwner = vi.mocked(getOwner)
const OWNER = { userId: 'owner-a', workspaceId: 'firm-a' }
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body: unknown = {}) =>
  new Request('http://test/x', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(verifyCsrf).mockResolvedValue(true)
})

describe('/api/people is owner-only', () => {
  const CASES: Array<{ name: string; run: () => Promise<Response>; effect: () => unknown }> = [
    { name: 'GET /api/people', run: () => peopleGET(), effect: () => listPeople },
    {
      name: 'POST /api/people',
      run: () => peoplePOST(post({ email: 'x@y.z' })),
      effect: () => createPerson,
    },
    {
      name: 'POST /api/people/[id]/block',
      run: () => blockPOST(post({ blocked: true }), params('u2')),
      effect: () => setPersonBlocked,
    },
    {
      name: 'POST /api/people/[id]/reset-password',
      run: () => resetPOST(post(), params('u2')),
      effect: () => resetPersonPassword,
    },
  ]

  for (const c of CASES) {
    it(`403s for a member: ${c.name}`, async () => {
      mockGetOwner.mockResolvedValue(null)
      const res = await c.run()
      // 403 rather than 404: a member knows this surface exists, they simply
      // may not use it. The platform tier is the opposite.
      expect(res.status).toBe(403)
      expect(c.effect()).not.toHaveBeenCalled()
    })
  }
})

describe('the workspace comes from the session, never the request', () => {
  it('ignores a workspaceId forged into the create body', async () => {
    mockGetOwner.mockResolvedValue(OWNER)
    vi.mocked(createPerson).mockResolvedValue({ ok: true, userId: 'u9', tempPassword: 'tmp' })

    await peoplePOST(
      post({
        email: 'mole@firm-b.test',
        role: 'member',
        // Every shape someone might try.
        workspaceId: 'firm-b',
        workspace_id: 'firm-b',
        workspace: 'firm-b',
      }),
    )

    expect(createPerson).toHaveBeenCalledWith({
      workspaceId: 'firm-a', // the session's, not the body's
      email: 'mole@firm-b.test',
      name: null,
      role: 'member',
    })
  })

  it('scopes block and reset to the session’s workspace', async () => {
    mockGetOwner.mockResolvedValue(OWNER)
    vi.mocked(setPersonBlocked).mockResolvedValue('ok')
    vi.mocked(resetPersonPassword).mockResolvedValue({ ok: true, tempPassword: 't' })

    await blockPOST(post({ blocked: true, workspaceId: 'firm-b' }), params('u2'))
    expect(setPersonBlocked).toHaveBeenCalledWith({
      actorId: 'owner-a',
      targetId: 'u2',
      workspaceId: 'firm-a',
      blocked: true,
    })

    await resetPOST(post({ workspaceId: 'firm-b' }), params('u2'))
    expect(resetPersonPassword).toHaveBeenCalledWith({ targetId: 'u2', workspaceId: 'firm-a' })
  })

  it('refuses self-block with a clear message rather than a generic 404', async () => {
    mockGetOwner.mockResolvedValue(OWNER)
    vi.mocked(setPersonBlocked).mockResolvedValue('self')
    const res = await blockPOST(post({ blocked: true }), params('owner-a'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('your own account')
  })

  it('404s a target outside the firm', async () => {
    mockGetOwner.mockResolvedValue(OWNER)
    vi.mocked(setPersonBlocked).mockResolvedValue('notfound')
    expect((await blockPOST(post({ blocked: true }), params('u-other'))).status).toBe(404)
  })

  it('defaults an unrecognised role to member, never owner', async () => {
    mockGetOwner.mockResolvedValue(OWNER)
    vi.mocked(createPerson).mockResolvedValue({ ok: true, userId: 'u9', tempPassword: 'tmp' })
    await peoplePOST(post({ email: 'a@b.c', role: 'superuser' }))
    expect(createPerson).toHaveBeenCalledWith(expect.objectContaining({ role: 'member' }))
  })
})
