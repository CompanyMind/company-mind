import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { setDocumentGroups } from '@/lib/groups'

export const runtime = 'nodejs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params
  const { groupIds } = (await req.json().catch(() => ({}))) as { groupIds?: string[] }
  // The engine scopes the write to this workspace and ignores foreign groups.
  await setDocumentGroups(id, auth.workspace.id, Array.isArray(groupIds) ? groupIds : [])
  return NextResponse.json({ ok: true })
}
