import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { renameGroup, deleteGroup } from '@/lib/groups'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const ok = await renameGroup(auth.workspace.id, id, clean)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const res = await deleteGroup(auth.workspace.id, id)
  if (res === 'notfound') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (res === 'default')
    return NextResponse.json({ error: 'the Everyone group cannot be deleted' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
