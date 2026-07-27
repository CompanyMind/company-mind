import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { organizeFolders } from '@/lib/folders'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const result = await organizeFolders(owner.workspaceId)
  if (result === 'nothing') {
    return NextResponse.json(
      { error: 'nothing to organise — every indexed document is already in a folder' },
      { status: 400 },
    )
  }
  return NextResponse.json(result)
}
