import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { listFolders, createFolder } from '@/lib/folders'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await listFolders(auth.workspace.id))
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (clean.length > 60) {
    return NextResponse.json({ error: 'name is too long (60 characters max)' }, { status: 400 })
  }
  const f = await createFolder(auth.workspace.id, clean)
  if (f === 'conflict') {
    return NextResponse.json({ error: 'a folder with that name already exists' }, { status: 409 })
  }
  return NextResponse.json({ folder: f }, { status: 201 })
}
