import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { createPerson, listPeople } from '@/lib/people'

export const runtime = 'nodejs'

// 403, not 404: a member knows this surface exists, they simply may not use it.
// (The platform tier is the opposite — there, existence itself is the secret.)
const forbidden = () => NextResponse.json({ error: 'forbidden' }, { status: 403 })

export async function GET() {
  const owner = await getOwner()
  if (!owner) return forbidden()
  return NextResponse.json({ people: await listPeople(owner.workspaceId) })
}

export async function POST(req: Request) {
  const owner = await getOwner()
  if (!owner) return forbidden()
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    email?: string
    name?: string | null
    role?: string
  }

  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'a valid email is required' }, { status: 400 })
  }

  const role = body.role === 'owner' ? 'owner' : 'member'
  const rawName = body.name != null ? String(body.name).trim() : ''

  // The workspace comes from the SESSION. Any workspaceId in the body is
  // ignored outright rather than validated — there is no legitimate reason for
  // a client to name one, so there is nothing to check. See
  // lib/people-scoping.test.ts.
  const result = await createPerson({
    workspaceId: owner.workspaceId,
    email,
    name: rawName || null,
    role,
  })

  if (!result.ok) {
    return NextResponse.json({ error: 'that email is already in use' }, { status: 409 })
  }

  // Shown once, never logged, never re-fetchable.
  return NextResponse.json(
    { userId: result.userId, tempPassword: result.tempPassword },
    { status: 201 },
  )
}
