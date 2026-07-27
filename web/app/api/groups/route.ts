import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { db } from '@/lib/db/client'
import { memberships, users } from '@/lib/db/schema'
import { listGroups, createGroup } from '@/lib/groups'

export const runtime = 'nodejs'

// Owner-only. This returns the group structure AND every workspace user's email
// and name — a staff directory. A member has no owner-tier control that needs
// it, and the permanent explanation of the access model lives as prose on the
// Access page itself, not behind this endpoint.
export async function GET() {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const gs = await listGroups(owner.workspaceId)
  // Workspace users are an auth-table fact, resolved here.
  const wsUsers = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, owner.workspaceId))
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

// GET stays member-reachable: the Access page's read-only explainer needs it, and
// knowing which groups exist is not the same as being able to change them. Every
// mutation below is owner-only.
export async function POST(req: Request) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const g = await createGroup(owner.workspaceId, clean)
  if (g === 'conflict') {
    return NextResponse.json({ error: 'a group with that name already exists' }, { status: 409 })
  }
  return NextResponse.json(
    { group: { id: g.id, name: g.name, isDefault: g.isDefault, memberUserIds: [] } },
    { status: 201 },
  )
}
