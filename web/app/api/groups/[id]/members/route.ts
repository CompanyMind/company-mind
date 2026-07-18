import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { setGroupMembers } from '@/lib/groups'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { userIds } = (await req.json().catch(() => ({}))) as { userIds?: string[] }
  const requested = Array.isArray(userIds) ? userIds : []
  // Keep only users who actually belong to this workspace — an auth-owned check.
  const valid = requested.length
    ? await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.workspaceId, auth.workspace.id),
            inArray(memberships.userId, requested),
          ),
        )
    : []
  await setGroupMembers(
    id,
    auth.workspace.id,
    valid.map((v) => v.userId),
  )
  return NextResponse.json({ ok: true })
}
