import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { setTelegramLinkGroups } from '@/lib/telegram'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { groupIds } = (await req.json().catch(() => ({}))) as { groupIds?: string[] }
  await setTelegramLinkGroups(id, owner.workspaceId, Array.isArray(groupIds) ? groupIds : [])
  return NextResponse.json({ ok: true })
}
