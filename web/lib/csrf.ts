import 'server-only'
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'
import { SESSION_COOKIE } from '@/lib/auth/constants'

// Double-submit CSRF without a second cookie write: the token is an HMAC of the
// session token under SESSION_SECRET. The page reads it (no cookie mutation, so
// it is safe during render) and passes it to the client, which echoes it in the
// x-csrf-token header; the server recomputes it from the session and compares.
// A cross-site attacker can neither read the session cookie nor forge the HMAC,
// which — with SameSite=Lax on the session — closes CSRF on state-changing routes.
function tokenFor(sessionValue: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(sessionValue).digest('hex')
}

export async function issueCsrf(): Promise<string> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value
  return session ? tokenFor(session) : ''
}

export async function verifyCsrf(req: Request): Promise<boolean> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value
  const header = req.headers.get('x-csrf-token') ?? ''
  if (!session || !header) return false
  const a = Buffer.from(tokenFor(session))
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}
