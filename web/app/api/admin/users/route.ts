import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'
import { listAdminUsers, createUser } from '@/lib/auth/admin-users'

export const runtime = 'nodejs'

// 404, not 403, on every admin route: a 403 would confirm to a non-admin that
// the surface exists at all.
export async function GET() {
  const admin = await getSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const users = await listAdminUsers()
  return NextResponse.json({ users })
}

export async function POST(req: Request) {
  const admin = await getSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as {
    email?: string
    name?: string | null
    workspaceId?: string
    role?: string
  }

  // Lowercased for storage to match the lookup in login/actions.ts — a
  // mismatch here would create an account nobody can sign into.
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'a valid email is required' }, { status: 400 })
  }

  const role = body.role
  if (role !== 'owner' && role !== 'member') {
    return NextResponse.json({ error: "role must be 'owner' or 'member'" }, { status: 400 })
  }

  const workspaceId = String(body.workspaceId ?? '').trim()
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }
  // Any lookup failure (including a malformed id) means "not a real
  // workspace" — a 400, never a 500.
  let ws: { id: string } | undefined
  try {
    ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
  } catch {
    ws = undefined
  }
  if (!ws) return NextResponse.json({ error: 'workspace not found' }, { status: 400 })

  const rawName = body.name != null ? String(body.name).trim() : ''
  const name = rawName || null

  const result = await createUser({ email, name, workspaceId, role })
  if (result === 'duplicate') {
    return NextResponse.json({ error: 'a user with that email already exists' }, { status: 409 })
  }

  // The temp password is returned here, and only here — never logged, never
  // re-fetchable.
  return NextResponse.json(
    {
      user: { id: result.id, email, name, workspaceId, role },
      tempPassword: result.tempPassword,
    },
    { status: 201 },
  )
}
