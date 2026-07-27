import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { listGroups } from '@/lib/groups'
import { connectTelegram, disconnectTelegram, getTelegramStatus, listLinks } from '@/lib/telegram'

export const runtime = 'nodejs'

export async function GET() {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const [status, links, groups] = await Promise.all([
    getTelegramStatus(owner.workspaceId),
    listLinks(owner.workspaceId),
    listGroups(owner.workspaceId),
  ])
  return NextResponse.json({
    telegram: status,
    links,
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
  })
}

export async function POST(req: Request) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { token } = (await req.json().catch(() => ({}))) as { token?: string }
  const clean = (token ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'bot token is required' }, { status: 400 })
  try {
    const { username } = await connectTelegram(owner.workspaceId, clean)
    return NextResponse.json({ username })
  } catch {
    return NextResponse.json({ error: 'that bot token was rejected by Telegram' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  await disconnectTelegram(owner.workspaceId)
  return NextResponse.json({ ok: true })
}
