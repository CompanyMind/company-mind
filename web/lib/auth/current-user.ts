import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from './session'
import { validateSessionToken, type Session } from './session-store'

export async function getCurrentUser(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return validateSessionToken(token)
}
