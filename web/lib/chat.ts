import 'server-only'
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chats, messages, citations } from '@/lib/db/schema'
import type { EngineCitation } from '@/lib/engine'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: {
    marker: number
    chunkId: string | null
    filename: string
    page: number | null
    snippet: string
  }[]
}

export type ChatSummary = {
  id: string
  title: string | null
  updatedAt: Date
}

// Every chat is owned by exactly one (workspaceId, userId) pair. All reads and
// writes below scope to both — a user can only ever see/touch their own chats.

export async function listChats(
  workspaceId: string,
  userId: string,
  q?: string,
): Promise<ChatSummary[]> {
  const scope = and(eq(chats.workspaceId, workspaceId), eq(chats.userId, userId))
  const query = q?.trim()
  const where = query
    ? and(
        scope,
        or(
          ilike(chats.title, `%${query}%`),
          inArray(
            chats.id,
            db
              .select({ chatId: messages.chatId })
              .from(messages)
              .where(ilike(messages.content, `%${query}%`)),
          ),
        ),
      )
    : scope
  return db
    .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .where(where)
    .orderBy(desc(chats.updatedAt))
}

export async function createChat(workspaceId: string, userId: string): Promise<{ id: string }> {
  const [c] = await db.insert(chats).values({ workspaceId, userId, title: null }).returning()
  return { id: c.id }
}

export async function chatOwned(
  chatId: string,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const row = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.workspaceId, workspaceId), eq(chats.userId, userId)),
    columns: { id: true },
  })
  return !!row
}

export async function getChatMessages(
  chatId: string,
  workspaceId: string,
  userId: string,
): Promise<ChatMessage[] | null> {
  if (!(await chatOwned(chatId, workspaceId, userId))) return null

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))
  const messageIds = rows.map((m) => m.id)
  const cites = messageIds.length
    ? await db.select().from(citations).where(inArray(citations.messageId, messageIds))
    : []
  return rows.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    citations: cites
      .filter((c) => c.messageId === m.id)
      .sort((a, b) => a.marker - b.marker)
      .map((c) => ({
        marker: c.marker,
        chunkId: c.chunkId,
        filename: c.filename,
        page: c.page,
        snippet: c.snippet,
      })),
  }))
}

export async function renameChat(
  chatId: string,
  workspaceId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  if (!(await chatOwned(chatId, workspaceId, userId))) return false
  await db.update(chats).set({ title }).where(eq(chats.id, chatId))
  return true
}

export async function deleteChat(
  chatId: string,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  if (!(await chatOwned(chatId, workspaceId, userId))) return false
  await db.delete(chats).where(eq(chats.id, chatId)) // cascades to messages/citations
  return true
}

export async function saveTurn(opts: {
  chatId: string
  workspaceId: string
  question: string
  answer: string
  engineCitations: EngineCitation[]
  title?: string
}): Promise<ChatMessage> {
  await db.insert(messages).values({
    chatId: opts.chatId,
    workspaceId: opts.workspaceId,
    role: 'user',
    content: opts.question,
  })
  const [assistant] = await db
    .insert(messages)
    .values({
      chatId: opts.chatId,
      workspaceId: opts.workspaceId,
      role: 'assistant',
      content: opts.answer,
    })
    .returning()
  if (opts.engineCitations.length) {
    await db.insert(citations).values(
      opts.engineCitations.map((c) => ({
        messageId: assistant.id,
        workspaceId: opts.workspaceId,
        chunkId: c.chunk_id,
        marker: c.marker,
        documentId: c.document_id,
        filename: c.filename,
        page: c.page,
        snippet: c.snippet,
      })),
    )
  }
  // Bump updatedAt on every turn (drives listChats ordering). Only set the
  // title if the caller supplied one AND the chat doesn't already have one —
  // the route decides *when* to compute a smart title (first turn only); this
  // just persists it without a race against a title set in the meantime.
  await db
    .update(chats)
    .set(
      opts.title
        ? { updatedAt: new Date(), title: sql`coalesce(${chats.title}, ${opts.title})` }
        : { updatedAt: new Date() },
    )
    .where(eq(chats.id, opts.chatId))

  return {
    id: assistant.id,
    role: 'assistant',
    content: opts.answer,
    citations: opts.engineCitations
      .slice()
      .sort((a, b) => a.marker - b.marker)
      .map((c) => ({
        marker: c.marker,
        chunkId: c.chunk_id,
        filename: c.filename,
        page: c.page,
        snippet: c.snippet,
      })),
  }
}
