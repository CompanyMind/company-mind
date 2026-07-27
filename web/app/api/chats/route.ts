import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { listChats, createChat, deleteAllChats } from '@/lib/chat'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const q = req.nextUrl.searchParams.get('q') ?? undefined
  const chats = await listChats(auth.workspace.id, auth.user.id, q)
  return NextResponse.json({ chats })
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await createChat(auth.workspace.id, auth.user.id)
  return NextResponse.json({ id })
}

/** Settings → Data → "Delete all my conversations". Scoped to the caller's own
 *  (workspace, user) from the session; the body is not read at all. */
export async function DELETE(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const count = await deleteAllChats(auth.workspace.id, auth.user.id)
  return NextResponse.json({ ok: true, count })
}
