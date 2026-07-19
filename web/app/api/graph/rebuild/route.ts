import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { rebuildGraph } from '@/lib/graph'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const job = await rebuildGraph(owner.workspaceId)
  return NextResponse.json({ job })
}
