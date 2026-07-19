import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { askEngine, generateTitle } from '@/lib/engine'
import { db } from '@/lib/db/client'
import { memberships, chats } from '@/lib/db/schema'
import { chatOwned, createChat, saveTurn } from '@/lib/chat'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { question, chatId: requestedChatId } = (await req.json().catch(() => ({}))) as {
    question?: string
    chatId?: string
  }
  const q = (question ?? '').trim()
  if (!q) return NextResponse.json({ error: 'empty question' }, { status: 400 })

  let chatId: string
  if (requestedChatId) {
    if (!(await chatOwned(requestedChatId, auth.workspace.id, auth.user.id))) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    chatId = requestedChatId
  } else {
    chatId = (await createChat(auth.workspace.id, auth.user.id)).id
  }

  // Role is an auth-table fact (memberships); the engine resolves the group-level
  // access itself from the principal.
  const mem = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, auth.user.id),
      eq(memberships.workspaceId, auth.workspace.id),
    ),
  })

  let result
  try {
    result = await askEngine(auth.workspace.id, q, auth.user.id, mem?.role ?? 'member')
  } catch {
    return NextResponse.json({ error: 'the answer engine is unavailable' }, { status: 502 })
  }

  // Only the first turn of a chat needs a title. Fetching the current title
  // instead of re-deriving "is this a new chat" keeps this correct whether the
  // chat was just created above or was an existing-but-untitled chat.
  const current = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    columns: { title: true },
  })
  const title = current && !current.title ? await generateTitle(q) : undefined

  // The engine writes the query_log audit row itself (single ask path). Web only
  // persists the chat turn for the dashboard transcript.
  const assistant = await saveTurn({
    chatId,
    workspaceId: auth.workspace.id,
    question: q,
    answer: result.answer,
    engineCitations: result.citations,
    title,
  })
  return NextResponse.json({
    message: assistant,
    insufficient: result.insufficient,
    chatId,
    title: title ?? current?.title ?? null,
  })
}
