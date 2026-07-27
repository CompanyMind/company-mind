import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { resetPersonPassword } from '@/lib/people'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { id } = await params
  let result: Awaited<ReturnType<typeof resetPersonPassword>>
  try {
    result = await resetPersonPassword({ targetId: id, workspaceId: owner.workspaceId })
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!result.ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  // Shown once. The person must choose their own on next sign-in.
  return NextResponse.json({ tempPassword: result.tempPassword })
}
