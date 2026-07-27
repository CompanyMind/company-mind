import { NextResponse } from 'next/server'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { deleteDocument } from '@/lib/documents'
import { deleteFile } from '@/lib/storage'

export const runtime = 'nodejs'

/**
 * Remove a document from the workspace: the record, its chunks, its group
 * tags, and the stored file.
 *
 * Owner-only, and enumerated in lib/control-plane-gates.test.ts. Deletion is
 * the most consequential control-plane action there is — a member who could
 * delete could revoke everyone's access to anything, which is the same power
 * as retagging, exercised once and irreversibly.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })
  const { id } = await params

  const storageKey = await deleteDocument(owner.workspaceId, id)
  if (storageKey === null) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Record first, bytes second, and deliberately not atomic. If this throws,
  // the file is orphaned on disk but unreachable — nothing indexes it and
  // nothing can name it. The other order would risk the opposite: a document
  // still listed and still retrievable whose file is gone.
  await deleteFile(storageKey)
  return NextResponse.json({ ok: true })
}
