import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { askEngine } from '@/lib/engine'
import { resolveAccess } from '@/lib/groups'
import { db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import { getOrCreateChat, listMessages, saveTurn } from '@/lib/chat'

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

  const mem = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, auth.user.id),
      eq(memberships.workspaceId, auth.workspace.id),
    ),
  })
  const access = await resolveAccess(auth.user.id, auth.workspace.id, mem?.role ?? 'member')

  let result
  try {
    result = await askEngine(auth.workspace.id, q, access, auth.user.id)
  } catch {
    return NextResponse.json({ error: 'the answer engine is unavailable' }, { status: 502 })
  }

  // The engine writes the query_log audit row itself (single ask path). Web only
  // persists the chat turn for the dashboard transcript.
  const chatId = await getOrCreateChat(auth.workspace.id, auth.user.id)
  const assistant = await saveTurn({
    chatId,
    workspaceId: auth.workspace.id,
    question: q,
    answer: result.answer,
    engineCitations: result.citations,
  })
  return NextResponse.json({ message: assistant, insufficient: result.insufficient })
}
