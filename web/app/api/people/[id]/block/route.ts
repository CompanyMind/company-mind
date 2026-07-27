import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { setPersonBlocked } from '@/lib/people'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { id } = await params
  const { blocked } = (await req.json().catch(() => ({}))) as { blocked?: boolean }

  let result: Awaited<ReturnType<typeof setPersonBlocked>>
  try {
    result = await setPersonBlocked({
      actorId: owner.userId,
      targetId: id,
      // From the session. An owner cannot reach another firm's person by
      // guessing an id: setPersonBlocked verifies membership in THIS workspace.
      workspaceId: owner.workspaceId,
      blocked: blocked === true,
    })
  } catch {
    result = 'notfound'
  }

  if (result === 'self') {
    return NextResponse.json(
      { error: 'you cannot block your own account' },
      { status: 400 },
    )
  }
  if (result === 'notfound') return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, blocked: blocked === true })
}
