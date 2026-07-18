import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { setLinkStatus } from '@/lib/telegram'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { action } = (await req.json().catch(() => ({}))) as { action?: string }
  const res = await setLinkStatus(id, auth.workspace.id, action ?? '')
  if (res === 'notfound') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (res === 'unknown') return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
