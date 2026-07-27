import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { users, userTourSteps } from '@/lib/db/schema'
import { isKnownTourStepKey } from '@/lib/tour/step-keys'

export const runtime = 'nodejs'

/**
 * Records tour progress. Body is either `{ stepKey }` — the provider calls
 * this the moment a step is SHOWN, not completed (spec §6's honest "seen"
 * semantic) — or `{ dismissed: true }` — the pill's own decline action.
 *
 * `stepKey` is validated against the known set (web/lib/tour/step-keys.ts)
 * and rejected with 400 otherwise: a typo in a step key must never silently
 * pollute `user_tour_steps` with a row `nextStepKey` (state.ts) will then
 * never match against anything, quietly breaking that user's resume.
 *
 * The insert is `ON CONFLICT DO NOTHING` — replaying an already-seen step
 * (the rail's Guide item, or simply revisiting a step via Back) must never
 * fail or overwrite the original `seen_at`.
 */
export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  if ('dismissed' in body) {
    if (body.dismissed !== true) {
      return NextResponse.json({ error: 'bad request' }, { status: 400 })
    }
    // users is an auth table — web owns it and writes it directly.
    await db.update(users).set({ tourDismissedAt: new Date() }).where(eq(users.id, auth.user.id))
    return NextResponse.json({ ok: true })
  }

  const { stepKey } = body as { stepKey?: unknown }
  if (!isKnownTourStepKey(stepKey)) {
    return NextResponse.json({ error: 'unknown step key' }, { status: 400 })
  }

  await db
    .insert(userTourSteps)
    .values({ userId: auth.user.id, workspaceId: auth.workspace.id, stepKey })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true })
}
