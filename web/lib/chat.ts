import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chats, messages, citations } from '@/lib/db/schema'
import type { EngineCitation } from '@/lib/engine'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: {
    marker: number
    chunkId: string
    filename: string
    page: number | null
    snippet: string
  }[]
}

export async function getOrCreateChat(workspaceId: string, userId: string): Promise<string> {
  const existing = await db.query.chats.findFirst({ where: eq(chats.workspaceId, workspaceId) })
  if (existing) return existing.id
  const [c] = await db.insert(chats).values({ workspaceId, userId, title: 'Ask' }).returning()
  return c.id
}

export async function listMessages(chatId: string, workspaceId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.workspaceId, workspaceId)))
    .orderBy(asc(messages.createdAt))
  const cites = await db.select().from(citations).where(eq(citations.workspaceId, workspaceId))
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

export async function saveTurn(opts: {
  chatId: string
  workspaceId: string
  question: string
  answer: string
  engineCitations: EngineCitation[]
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

