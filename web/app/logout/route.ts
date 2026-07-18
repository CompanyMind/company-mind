import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { revokeSessionToken } from '@/lib/auth/session-store'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await revokeSessionToken(token)
  jar.delete(SESSION_COOKIE)
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
