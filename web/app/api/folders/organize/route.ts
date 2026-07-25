import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { organizeFolders } from '@/lib/folders'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const result = await organizeFolders(auth.workspace.id)
  if (result === 'nothing') {
    return NextResponse.json(
      { error: 'nothing to organise — every indexed document is already in a folder' },
      { status: 400 },
    )
  }
  return NextResponse.json(result)
}
