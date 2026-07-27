import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { setGroupMembers } from '@/lib/groups'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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
            eq(memberships.workspaceId, owner.workspaceId),
            inArray(memberships.userId, requested),
          ),
        )
    : []
  await setGroupMembers(
    id,
    owner.workspaceId,
    valid.map((v) => v.userId),
  )
  return NextResponse.json({ ok: true })
}
