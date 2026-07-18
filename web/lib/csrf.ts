import 'server-only'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'

const CSRF_COOKIE = 'cb_csrf'

export async function issueCsrf(): Promise<string> {
  const jar = await cookies()
  let token = jar.get(CSRF_COOKIE)?.value
  if (!token) {
    token = randomBytes(24).toString('base64url')
    jar.set(CSRF_COOKIE, token, {
      httpOnly: false, // readable by the client so it can echo it in the header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
  }
  return token
}

export async function verifyCsrf(req: Request): Promise<boolean> {
  const jar = await cookies()
  const cookieToken = jar.get(CSRF_COOKIE)?.value
  const headerToken = req.headers.get('x-csrf-token')
  return Boolean(cookieToken && headerToken && cookieToken === headerToken)
}
