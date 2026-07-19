import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { getChatMessages, renameChat, deleteChat } from '@/lib/chat'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const messages = await getChatMessages(id, auth.workspace.id, auth.user.id)
  if (messages === null) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ messages })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { title } = (await req.json().catch(() => ({}))) as { title?: string }
  const clean = (title ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const ok = await renameChat(id, auth.workspace.id, auth.user.id, clean)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const ok = await deleteChat(id, auth.workspace.id, auth.user.id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
