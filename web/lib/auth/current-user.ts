import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from './session'
import { validateSessionToken, type User, type Workspace } from './session-store'

export async function getCurrentUser(): Promise<{ user: User; workspace: Workspace } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return validateSessionToken(token)
}
