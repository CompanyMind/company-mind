/**
 * /api/me changes only the caller's own row.
 *
 * The forged-id case is the one that matters: lib/me.test.ts proves the
 * validator drops an id from the body, and this proves the ROUTE never had a
 * way to use one in the first place — it passes the session's user id and
 * nothing else.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { updateProfile } from '@/lib/me'
import { PATCH } from '@/app/api/me/route'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(), issueCsrf: vi.fn() }))
vi.mock('@/lib/me', async (orig) => ({
  ...(await orig<typeof import('@/lib/me')>()),
  updateProfile: vi.fn(),
}))

const SESSION = {
  user: { id: 'user-a', locale: 'en' },
  workspace: { id: 'firm-a' },
  role: 'member',
} as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

const patch = (body: unknown) =>
  new Request('http://test/api/me', { method: 'PATCH', body: JSON.stringify(body) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(verifyCsrf).mockResolvedValue(true)
  vi.mocked(getCurrentUser).mockResolvedValue(SESSION)
})

describe('PATCH /api/me', () => {
  it('401s when signed out, without writing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await PATCH(patch({ theme: 'dark' }))).status).toBe(401)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('403s without a valid CSRF token, without writing', async () => {
    vi.mocked(verifyCsrf).mockResolvedValue(false)
    expect((await PATCH(patch({ theme: 'dark' }))).status).toBe(403)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('400s on an invalid value, without writing', async () => {
    expect((await PATCH(patch({ locale: 'de' }))).status).toBe(400)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('400s on a body that is not an object at all', async () => {
    const res = await PATCH(
      new Request('http://test/api/me', { method: 'PATCH', body: 'not json' }),
    )
    expect(res.status).toBe(400)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('writes only to the session user, ignoring an id in the body', async () => {
    const res = await PATCH(patch({ id: 'victim', userId: 'victim', theme: 'dark' }))
    expect(res.status).toBe(200)
    expect(updateProfile).toHaveBeenCalledWith('user-a', { theme: 'dark' })
  })

  it('mirrors theme and motion into cookies so the server render matches', async () => {
    const res = await PATCH(patch({ theme: 'dark', motion: 'reduced' }))
    const cookies = res.headers.getSetCookie().join(' ')
    expect(cookies).toContain('cm_theme=dark')
    expect(cookies).toContain('cm_motion=reduced')
  })

  it('does not touch the theme cookie when the patch does not mention theme', async () => {
    const res = await PATCH(patch({ name: 'Dovud' }))
    expect(res.headers.getSetCookie().join(' ')).not.toContain('cm_theme')
  })
})
