import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getDocument } from '@/lib/documents'
import { readFile } from '@/lib/storage'
import { contentDisposition } from '@/lib/content-disposition'

export const runtime = 'nodejs'

/**
 * Download the original file.
 *
 * Not owner-only: anyone who can retrieve a document can already read its text
 * through /s/[chunkId], so withholding the file it came from would protect
 * nothing while making the product feel like it was holding the customer's own
 * documents hostage. The gate is the access model — getDocument applies the
 * same predicate as the listing and returns null both for "no such document"
 * and "not yours", which is why this 404s rather than 403s.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params

  const doc = await getDocument(auth.workspace.id, { userId: auth.user.id, role: auth.role }, id)
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let data: Buffer
  try {
    data = await readFile(doc.storageKey)
  } catch {
    // The record exists but the bytes do not — a restored database without its
    // storage volume, most likely. Say so as a server fault; pretending it is a
    // 404 would send the owner hunting for a document that is right there.
    return NextResponse.json({ error: 'file unavailable' }, { status: 500 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'content-type': doc.mime,
      'content-length': String(data.byteLength),
      // attachment, always: these are customer uploads, and rendering one
      // inline on our own origin would run whatever it contains against the
      // session cookie. nosniff stops the browser overriding content-type.
      'content-disposition': contentDisposition(doc.filename),
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  })
}
