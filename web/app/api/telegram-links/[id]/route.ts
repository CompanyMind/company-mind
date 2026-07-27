import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { setLinkStatus } from '@/lib/telegram'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { action } = (await req.json().catch(() => ({}))) as { action?: string }
  const res = await setLinkStatus(id, owner.workspaceId, action ?? '')
  if (res === 'notfound') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (res === 'unknown') return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
