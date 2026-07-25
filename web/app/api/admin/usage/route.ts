import { NextResponse } from 'next/server'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { getUsageSummary } from '@/lib/usage'

export const runtime = 'nodejs'

// GET-only and read-only: getSuperAdmin() -> 404 gates it, same as every
// other admin route, but there is no mutation so no CSRF check is needed.
export async function GET(req: Request) {
  const admin = await getSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const daysParam = Number(new URL(req.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.trunc(daysParam) : 30

  // The engine owns query_log/documents/folders and returns the aggregate
  // counts; the platform-wide user count is auth-side. Merged here, not in
  // the engine, since users/memberships are web's tables.
  const [summary, allUsers] = await Promise.all([
    getUsageSummary(days),
    db.select({ id: users.id }).from(users),
  ])

  return NextResponse.json({ ...summary, totalUsers: allUsers.length })
}
