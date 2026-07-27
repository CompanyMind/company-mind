import { NextResponse } from 'next/server'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { verifyCsrf } from '@/lib/csrf'
import { createFirm, listFirms } from '@/lib/platform/firms'

export const runtime = 'nodejs'

// 404, not 403, on every platform route: a 403 would confirm to a non-admin
// that the surface exists at all.
const notFound = () => NextResponse.json({ error: 'not found' }, { status: 404 })

export async function GET() {
  if (!(await getSuperAdmin())) return notFound()
  return NextResponse.json({ firms: await listFirms() })
}

export async function POST(req: Request) {
  if (!(await getSuperAdmin())) return notFound()
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    ownerEmail?: string
    ownerName?: string | null
  }

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'a firm name is required' }, { status: 400 })

  const ownerEmail = String(body.ownerEmail ?? '')
    .trim()
    .toLowerCase()
  if (!ownerEmail || !ownerEmail.includes('@')) {
    return NextResponse.json({ error: "the first owner's email is required" }, { status: 400 })
  }

  const rawName = body.ownerName != null ? String(body.ownerName).trim() : ''
  const result = await createFirm({ name, ownerEmail, ownerName: rawName || null })

  if (!result.ok) {
    const message =
      result.reason === 'duplicate-email'
        ? 'a user with that email already exists'
        : 'a firm with a very similar name already exists'
    return NextResponse.json({ error: message }, { status: 409 })
  }

  // The temp password is returned here and only here — never logged, never
  // re-fetchable. `bootstrapped: false` means the firm exists and works but its
  // Everyone group is not there yet; the panel says so rather than pretending.
  return NextResponse.json(
    {
      workspaceId: result.workspaceId,
      ownerId: result.ownerId,
      tempPassword: result.tempPassword,
      bootstrapped: result.bootstrapped,
    },
    { status: 201 },
  )
}
