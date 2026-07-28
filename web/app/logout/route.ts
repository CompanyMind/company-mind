import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { revokeSessionToken } from '@/lib/auth/session-store'

export const runtime = 'nodejs'

/**
 * Sign out: revoke the session server-side, drop the cookie, send them to login.
 *
 * The redirect is RELATIVE, and must stay that way. `request.url` in a route
 * handler is built from the server's own listening socket — inside Docker that
 * is the container id and the internal port — not from the `Host` header, which
 * Next does not consult here. `NextResponse.redirect()` requires an absolute
 * URL, so `new URL('/login', request.url)` baked that address into `Location`
 * and signing out sent people to `https://3a311553147d:3000/login`, which
 * resolves nowhere outside the compose network (reported from production
 * 2026-07-28: DNS_PROBE_POSSIBLE). nginx was forwarding `Host` correctly the
 * whole time — verified by reproducing it with the header set, unset, and
 * through the proxy; only the scheme travels, via `X-Forwarded-Proto`.
 *
 * RFC 7231 §7.1.2 allows a relative URI-reference in `Location`, and the browser
 * resolves it against the URL it actually asked for — the public one. This is
 * what Next's own middleware emits (`Location: /login`), which is why the
 * signed-out redirect to login always worked while signing OUT did not. No
 * proxy configuration, no trusted-host list, no environment variable to forget.
 */
export async function POST() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await revokeSessionToken(token)
  jar.delete(SESSION_COOKIE)
  return new NextResponse(null, { status: 303, headers: { location: '/login' } })
}
