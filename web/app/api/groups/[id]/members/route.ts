import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { groups } from '@/lib/db/schema'
import { setGroupMembers } from '@/lib/groups'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const g = await db.query.groups.findFirst({
    where: and(eq(groups.id, id), eq(groups.workspaceId, auth.workspace.id)),
  })
  if (!g) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { userIds } = (await req.json().catch(() => ({}))) as { userIds?: string[] }
  await setGroupMembers(id, auth.workspace.id, Array.isArray(userIds) ? userIds : [])
  return NextResponse.json({ ok: true })
}
