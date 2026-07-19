import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { getGraph } from '@/lib/graph'

export const runtime = 'nodejs'

// The Brain Map is owner-only. The owner always queries the engine as role
// 'owner'; `as_group` drives the "view as" filter on top of that.
export async function GET(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const asGroup = req.nextUrl.searchParams.get('as_group') ?? undefined
  const result = await getGraph(owner.workspaceId, owner.userId, 'owner', asGroup)
  return NextResponse.json(result)
}
