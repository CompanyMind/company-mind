import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { cleanProfilePatch, updateProfile } from '@/lib/me'
import { MOTION_COOKIE, PREF_COOKIE_MAX_AGE, THEME_COOKIE } from '@/lib/theme'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const patch = cleanProfilePatch(await req.json().catch(() => null))
  if (!patch) return NextResponse.json({ error: 'invalid patch' }, { status: 400 })

  // The user id comes from the session. There is no code path here that reads
  // one from the request — see lib/me-routes.test.ts.
  await updateProfile(auth.user.id, patch)

  const res = NextResponse.json({ ok: true })
  // Mirrored so app/layout.tsx can stamp data-theme server-side on the very
  // first paint. Not HttpOnly: these are preferences, not credentials, and
  // nothing authorizes on them. Only written when the patch actually mentions
  // them, so changing a name cannot quietly reset someone's theme.
  const opts = { path: '/', sameSite: 'lax' as const, maxAge: PREF_COOKIE_MAX_AGE }
  if (patch.theme) res.cookies.set(THEME_COOKIE, patch.theme, opts)
  if (patch.motion) res.cookies.set(MOTION_COOKIE, patch.motion, opts)
  return res
}
