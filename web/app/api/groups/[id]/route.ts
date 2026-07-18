import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { groups } from '@/lib/db/schema'

export const runtime = 'nodejs'

async function ownGroup(id: string, workspaceId: string) {
  return db.query.groups.findFirst({
    where: and(eq(groups.id, id), eq(groups.workspaceId, workspaceId)),
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const g = await ownGroup(id, auth.workspace.id)
  if (!g) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group'
  await db.update(groups).set({ name: clean, slug }).where(eq(groups.id, id))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const g = await ownGroup(id, auth.workspace.id)
  if (!g) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (g.isDefault) return NextResponse.json({ error: 'the Everyone group cannot be deleted' }, { status: 400 })
  await db.delete(groups).where(eq(groups.id, id))
  return NextResponse.json({ ok: true })
}
