import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { saveFile } from '@/lib/storage'
import { ingestDocument } from '@/lib/engine'
import { listDocuments } from '@/lib/documents'
import { db } from '@/lib/db/client'
import { documents, ingestionJobs } from '@/lib/db/schema'

export const runtime = 'nodejs'

const ALLOWED = new Map<string, string>([
  ['pdf', 'application/pdf'],
  ['txt', 'text/plain'],
  ['md', 'text/markdown'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
])
const MAX_BYTES = 25 * 1024 * 1024

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ documents: await listDocuments(auth.workspace.id) })
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const mime = ALLOWED.get(ext)
  if (!mime) return NextResponse.json({ error: 'unsupported type' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 400 })

  const data = Buffer.from(await file.arrayBuffer())
  const { storageKey, bytes } = await saveFile(auth.workspace.id, file.name, data)

  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId: auth.workspace.id,
      filename: file.name,
      mime,
      bytes,
      storageKey,
      status: 'uploaded',
    })
    .returning()
  await db.insert(ingestionJobs).values({
    documentId: doc.id,
    workspaceId: auth.workspace.id,
    status: 'queued',
  })

  try {
    await ingestDocument({
      documentId: doc.id,
      workspaceId: auth.workspace.id,
      filename: file.name,
      mime,
      data,
    })
  } catch {
    await db
      .update(documents)
      .set({ status: 'failed', error: 'could not reach ingestion engine' })
      .where(eq(documents.id, doc.id))
    return NextResponse.json({ error: 'ingestion unavailable' }, { status: 502 })
  }
  return NextResponse.json({ document: doc }, { status: 201 })
}
