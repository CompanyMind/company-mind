import { NextResponse } from 'next/server'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { verifyCsrf } from '@/lib/csrf'
import { setFirmSuspended } from '@/lib/platform/firms'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSuperAdmin())) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { id } = await params
  const { suspended } = (await req.json().catch(() => ({}))) as { suspended?: boolean }

  // Suspending also deletes that firm's sessions, so it lands on the next
  // request rather than at cookie expiry (see setFirmSuspended).
  let result: 'ok' | 'notfound'
  try {
    result = await setFirmSuspended(id, suspended === true)
  } catch {
    // A malformed id is "not a real firm", not a 500.
    result = 'notfound'
  }
  if (result === 'notfound') return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, suspended: suspended === true })
}
