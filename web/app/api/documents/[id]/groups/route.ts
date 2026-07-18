import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { documents } from '@/lib/db/schema'
import { setDocumentGroups } from '@/lib/groups'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.workspaceId, auth.workspace.id)),
  })
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { groupIds } = (await req.json().catch(() => ({}))) as { groupIds?: string[] }
  await setDocumentGroups(id, auth.workspace.id, Array.isArray(groupIds) ? groupIds : [])
  return NextResponse.json({ ok: true })
}
