import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { saveFile } from '@/lib/storage'
import { uploadDocument } from '@/lib/engine'
import { listDocuments } from '@/lib/documents'
import { MAX_UPLOAD_BYTES, exceedsUploadLimit } from '@/lib/upload-limits'

export const runtime = 'nodejs'

const ALLOWED = new Map<string, string>([
  ['pdf', 'application/pdf'],
  ['txt', 'text/plain'],
  ['md', 'text/markdown'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
])

export async function GET(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const folder = new URL(req.url).searchParams.get('folder') ?? undefined
  return NextResponse.json({ documents: await listDocuments(auth.workspace.id, { userId: auth.user.id, role: auth.role }, folder) })
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  if (exceedsUploadLimit(req.headers.get('content-length'))) {
    return NextResponse.json({ error: 'too large' }, { status: 413 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const mime = ALLOWED.get(ext)
  if (!mime) return NextResponse.json({ error: 'unsupported type' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 })

  // Web owns file storage; the engine owns the document record + ingestion.
  const data = Buffer.from(await file.arrayBuffer())
  const { storageKey, bytes } = await saveFile(auth.workspace.id, file.name, data)

  let doc
  try {
    doc = await uploadDocument({
      workspaceId: auth.workspace.id,
      filename: file.name,
      mime,
      bytes,
      storageKey,
      data,
    })
  } catch {
    return NextResponse.json({ error: 'ingestion unavailable' }, { status: 502 })
  }
  return NextResponse.json({ document: doc }, { status: 201 })
}
