import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { listFolders, createFolder } from '@/lib/folders'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await listFolders(auth.workspace.id, { userId: auth.user.id, role: auth.role }))
}

// GET stays member-reachable and is scoped by the engine (a member only sees
// folders holding documents they can open). Creating one is an owner action.
export async function POST(req: Request) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { name } = (await req.json().catch(() => ({}))) as { name?: string }
  const clean = (name ?? '').trim()
  if (!clean) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (clean.length > 60) {
    return NextResponse.json({ error: 'name is too long (60 characters max)' }, { status: 400 })
  }
  const f = await createFolder(owner.workspaceId, clean)
  if (f === 'conflict') {
    return NextResponse.json({ error: 'a folder with that name already exists' }, { status: 409 })
  }
  return NextResponse.json({ folder: f }, { status: 201 })
}
