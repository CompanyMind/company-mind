import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { SESSION_COOKIE } from '@/lib/auth/constants'
import { verifyCsrf } from '@/lib/csrf'
import { listUserSessions, revokeAllSessions } from '@/lib/sessions'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  // The user id comes from the session, so there is no request-supplied value
  // that could widen this to anyone else's sessions.
  const rows = await listUserSessions(auth.user.id, auth.sessionId)
  return NextResponse.json({ sessions: rows })
}

export async function DELETE(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const count = await revokeAllSessions(auth.user.id)
  const res = NextResponse.json({ ok: true, count })
  // "All devices" includes this one — the label says so. Clearing the cookie
  // stops the caller holding a token whose row is gone, which would otherwise
  // read as a mysterious logout on their next navigation instead of a
  // deliberate one now.
  res.cookies.delete(SESSION_COOKIE)
  return res
}
