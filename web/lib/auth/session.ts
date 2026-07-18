import 'server-only'
import { randomBytes, createHash } from 'node:crypto'

// Re-exported for existing importers; the source of truth is edge-safe constants.
export { SESSION_COOKIE, SESSION_TTL_MS } from './constants'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
  }
}
