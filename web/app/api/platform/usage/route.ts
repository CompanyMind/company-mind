import { NextResponse } from 'next/server'
import { count } from 'drizzle-orm'
import { getSuperAdmin } from '@/lib/auth/require-super-admin'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { getUsageSummary } from '@/lib/usage'

export const runtime = 'nodejs'

// GET-only and read-only: getSuperAdmin() -> 404 gates it, same as every other
// platform route, but there is no mutation so no CSRF check is needed.
//
// Aggregate-only, and that is a tested invariant (lib/platform/aggregate-only
// .test.ts): no question text, no per-user activity row, ever. A drill-down
// "just for support" is exactly how an aggregate-only promise erodes.
export async function GET(req: Request) {
  if (!(await getSuperAdmin())) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const daysParam = Number(new URL(req.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.trunc(daysParam) : 30

  const [summary, [userCount]] = await Promise.all([
    getUsageSummary(days),
    db.select({ n: count() }).from(users),
  ])

  return NextResponse.json({ ...summary, totalUsers: userCount?.n ?? 0 })
}
