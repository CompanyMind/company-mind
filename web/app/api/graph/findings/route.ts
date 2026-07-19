import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { listFindings } from '@/lib/graph'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const asGroup = req.nextUrl.searchParams.get('as_group') ?? undefined
  const kind = req.nextUrl.searchParams.get('kind') ?? undefined
  const findings = await listFindings(owner.workspaceId, owner.userId, 'owner', asGroup, kind)
  return NextResponse.json({ findings })
}
