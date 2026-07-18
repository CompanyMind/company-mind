import 'server-only'
import { randomBytes, createHash } from 'node:crypto'

export const SESSION_COOKIE = 'cb_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

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
