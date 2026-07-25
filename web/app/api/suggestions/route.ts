import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { getSuggestions } from '@/lib/engine'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const mem = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, auth.user.id),
      eq(memberships.workspaceId, auth.workspace.id),
    ),
  })
  const questions = await getSuggestions(auth.workspace.id, auth.user.id, mem?.role ?? 'member')
  return NextResponse.json({ questions })
}
