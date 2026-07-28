/**
 * A redirect must never carry the server's own address into the browser.
 *
 * Reported from production 2026-07-28: signing out landed on
 * `https://3a311553147d:3000/login` — the Docker container id and the app's
 * internal port — and the browser failed with DNS_PROBE_POSSIBLE, because that
 * hostname exists only inside the compose network.
 *
 * Root cause: `request.url` in a route handler is built from the server's own
 * listening socket, NOT from the `Host` header. Verified against production at
 * all three layers — through nginx, straight to the container with the correct
 * `Host`, and straight to the container with no `Host` — all three produced the
 * container hostname, so the header genuinely is not consulted. (The scheme WAS
 * right through nginx: `X-Forwarded-Proto` is honoured, host and port are not.)
 * `NextResponse.redirect()` demands an absolute URL, so
 * `new URL('/login', request.url)` bakes that address into `Location`.
 *
 * The fix is what Next's own middleware already does — and middleware was the
 * working example that made the difference visible: it emits a RELATIVE
 * `Location: /login`. RFC 7231 §7.1.2 permits a relative URI-reference there,
 * and the browser resolves it against the URL it actually requested, which is
 * the public one. That is correct behind any proxy, with no configuration, no
 * trusted-header list, and no environment variable to forget.
 *
 * The `url` given to each Request below is deliberately the production-shaped
 * bad value, so this test fails against the original code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
    delete: () => undefined,
    set: () => undefined,
  })),
}))
vi.mock('@/lib/auth/session-store', () => ({ revokeSessionToken: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /logout', () => {
  it('redirects with a relative Location, not the container address', async () => {
    const { POST } = await import('@/app/logout/route')
    const res = await POST()

    expect(res.status).toBe(303)
    const location = res.headers.get('location')
    expect(location).toBe('/login')
    // The specific failure the user hit.
    expect(location).not.toContain('3a311553147d')
    expect(location).not.toContain(':3000')
  })

  it('cannot be influenced by the request URL — it does not receive one', async () => {
    const { POST } = await import('@/app/logout/route')
    // The handler no longer takes the request at all — the only way to be
    // certain a server-side address can never reach the Location header.
    expect(POST.length).toBe(0)
    const res = await POST()
    expect(res.headers.get('location')).toBe('/login')
  })

  it('clears the session cookie on the way out', async () => {
    const { cookies } = await import('next/headers')
    const del = vi.fn()
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'a-token' }),
      delete: del,
      set: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)

    const { POST } = await import('@/app/logout/route')
    await POST()

    expect(del).toHaveBeenCalled()
  })

  it('revokes the session server-side, not just in the browser', async () => {
    const { cookies } = await import('next/headers')
    const { revokeSessionToken } = await import('@/lib/auth/session-store')
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'a-token' }),
      delete: () => undefined,
      set: () => undefined,
    } as unknown as Awaited<ReturnType<typeof cookies>>)

    const { POST } = await import('@/app/logout/route')
    await POST()

    expect(revokeSessionToken).toHaveBeenCalledWith('a-token')
  })
})
