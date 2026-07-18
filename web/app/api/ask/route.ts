import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { askEngine } from '@/lib/engine'
import { getOrCreateChat, listMessages, saveTurn, logQuery } from '@/lib/chat'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const chatId = await getOrCreateChat(auth.workspace.id, auth.user.id)
  return NextResponse.json({ messages: await listMessages(chatId, auth.workspace.id) })
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { question } = (await req.json().catch(() => ({}))) as { question?: string }
  const q = (question ?? '').trim()
  if (!q) return NextResponse.json({ error: 'empty question' }, { status: 400 })

  let result
  try {
    result = await askEngine(auth.workspace.id, q)
  } catch {
    return NextResponse.json({ error: 'the answer engine is unavailable' }, { status: 502 })
  }

  const chatId = await getOrCreateChat(auth.workspace.id, auth.user.id)
  const assistant = await saveTurn({
    chatId,
    workspaceId: auth.workspace.id,
    question: q,
    answer: result.answer,
    engineCitations: result.citations,
  })
  await logQuery({
    workspaceId: auth.workspace.id,
    userId: auth.user.id,
    question: q,
    retrievedChunkIds: result.retrieved_chunk_ids,
    model: process.env.LLM_MODEL || 'fake',
  })
  return NextResponse.json({ message: assistant, insufficient: result.insufficient })
}
