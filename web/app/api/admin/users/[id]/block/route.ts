import { NextResponse } from 'next/server'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { verifyCsrf } from '@/lib/csrf'
import { blockUser, unblockUser } from '@/lib/auth/admin-users'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { id } = await params
  const { blocked } = (await req.json().catch(() => ({}))) as { blocked?: boolean }
  if (typeof blocked !== 'boolean') {
    return NextResponse.json({ error: 'blocked must be a boolean' }, { status: 400 })
  }

  if (blocked) {
    const res = await blockUser(admin.userId, id)
    if (res === 'self') {
      return NextResponse.json({ error: 'you cannot block your own account' }, { status: 400 })
    }
    if (res === 'notfound') return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  const ok = await unblockUser(id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
