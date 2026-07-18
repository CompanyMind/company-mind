import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { memberships, users } from '@/lib/db/schema'
import { listGroups, createGroup } from '@/lib/groups'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const gs = await listGroups(auth.workspace.id)
  // Workspace users are an auth-table fact, resolved here.
  const wsUsers = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, auth.workspace.id))
  return NextResponse.json({
    groups: gs.map((g) => ({
      id: g.id,
      name: g.name,
      isDefault: g.isDefault,
      memberUserIds: g.memberUserIds,
    })),
    users: wsUsers,
  })
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const g = await createGroup(auth.workspace.id, clean)
  if (g === 'conflict') {
    return NextResponse.json({ error: 'a group with that name already exists' }, { status: 409 })
  }
  return NextResponse.json(
    { group: { id: g.id, name: g.name, isDefault: g.isDefault, memberUserIds: [] } },
    { status: 201 },
  )
}
