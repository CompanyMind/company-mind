import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { MAX_WORKSPACE_NAME, renameWorkspace } from '@/lib/workspace'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
  const owner = await getOwner()
  // 403, not 404: a member knows their own workspace exists — they simply may
  // not rename it. (The platform tier is the opposite; there, absence is the
  // correct answer.)
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown }
  const clean = typeof name === 'string' ? name.trim() : ''
  if (!clean || clean.length > MAX_WORKSPACE_NAME) {
    return NextResponse.json({ error: 'invalid name' }, { status: 400 })
  }

  // The workspace id comes from the caller's own membership, never the body.
  await renameWorkspace(owner.workspaceId, clean)
  return NextResponse.json({ ok: true, name: clean })
}
