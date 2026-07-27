import { NextResponse } from 'next/server'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { verifyCsrf } from '@/lib/csrf'
import { resetOwnerPassword } from '@/lib/platform/firms'

export const runtime = 'nodejs'

// `id` here is the OWNER's user id, not the firm's. The one per-person action
// the platform tier keeps: a firm's owner is the top of that firm, so nobody
// inside it can unlock them. resetOwnerPassword refuses non-owners — members
// are their own firm's business.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSuperAdmin())) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { id } = await params
  let result: Awaited<ReturnType<typeof resetOwnerPassword>>
  try {
    result = await resetOwnerPassword(id)
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!result.ok) {
    return NextResponse.json({ error: 'that account is not a firm owner' }, { status: 400 })
  }
  // Shown once, never re-fetchable.
  return NextResponse.json({ tempPassword: result.tempPassword })
}
