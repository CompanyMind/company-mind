import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  // users is an auth table — web owns it and writes it directly.
  await db
    .update(users)
    .set({ onboardingDismissedAt: new Date() })
    .where(eq(users.id, auth.user.id))
  return NextResponse.json({ ok: true })
}
