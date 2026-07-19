import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { getTopic } from '@/lib/graph'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const asGroup = req.nextUrl.searchParams.get('as_group') ?? undefined
  const result = await getTopic(owner.workspaceId, id, owner.userId, 'owner', asGroup)
  return NextResponse.json(result)
}
