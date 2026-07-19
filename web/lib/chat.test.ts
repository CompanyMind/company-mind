import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chats } from '@/lib/db/schema'
import { chatOwned, getChatMessages, renameChat, deleteChat, listChats } from './chat'

// Drizzle is mocked with a small chainable/thenable fake: every builder method
// (from/where/orderBy/set/values) returns the same object so call chains keep
// working, and the object itself resolves (via `then`) to a configurable
// result — that's enough to exercise the code paths without a real Postgres.
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.from = vi.fn(self)
  chain.where = vi.fn(self)
  chain.orderBy = vi.fn(self)
  chain.set = vi.fn(self)
  chain.values = vi.fn(self)
  chain.returning = vi.fn(() => Promise.resolve(result))
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

vi.mock('@/lib/db/client', () => ({
  db: {
    query: { chats: { findFirst: vi.fn() } },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

// Spy on drizzle-orm's `eq` (keeping the real implementation) so we can assert
// *which* columns/values the ownership-scoped queries actually filter on,
// without needing to parse the internal SQL tree it produces.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(actual.eq) }
})

const mockFindFirst = vi.mocked(db.query.chats.findFirst)
const mockSelect = vi.mocked(db.select)
const mockUpdate = vi.mocked(db.update)
const mockDelete = vi.mocked(db.delete)
const mockEq = vi.mocked(eq)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('chatOwned', () => {
  it('returns true when the chat belongs to (workspaceId, userId)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'c1' } as never)
    await expect(chatOwned('c1', 'ws1', 'u1')).resolves.toBe(true)
  })

  it('returns false when no chat matches the (workspaceId, userId) scope', async () => {
    mockFindFirst.mockResolvedValue(undefined)
    await expect(chatOwned('c1', 'ws1', 'u1')).resolves.toBe(false)
  })

  it('scopes the lookup by chat id, workspace id, and user id', async () => {
    mockFindFirst.mockResolvedValue(undefined)
    await chatOwned('c1', 'ws1', 'u1')
    const calledWith = mockEq.mock.calls.map(([col, val]) => [col, val])
    expect(calledWith).toContainEqual([chats.id, 'c1'])
    expect(calledWith).toContainEqual([chats.workspaceId, 'ws1'])
    expect(calledWith).toContainEqual([chats.userId, 'u1'])
  })
})

describe('getChatMessages — cross-user isolation', () => {
  it('returns null (not the other user\'s messages) for a chat owned by someone else', async () => {
    mockFindFirst.mockResolvedValue(undefined) // ownership check fails
    const result = await getChatMessages('their-chat', 'ws1', 'attacker')
    expect(result).toBeNull()
    expect(mockSelect).not.toHaveBeenCalled() // never even queries messages
  })

  it('returns messages when the caller owns the chat', async () => {
    mockFindFirst.mockResolvedValue({ id: 'c1' } as never)
    mockSelect
      .mockReturnValueOnce(
        makeChain([{ id: 'm1', role: 'user', content: 'hi', createdAt: new Date() }]) as never,
      )
      .mockReturnValueOnce(makeChain([]) as never)
    const result = await getChatMessages('c1', 'ws1', 'u1')
    expect(result).toEqual([{ id: 'm1', role: 'user', content: 'hi', citations: [] }])
  })
})

describe('renameChat — cross-user isolation', () => {
  it('refuses to rename a chat owned by another user', async () => {
    mockFindFirst.mockResolvedValue(undefined)
    const ok = await renameChat('their-chat', 'ws1', 'attacker', 'Pwned title')
    expect(ok).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('renames when the caller owns the chat', async () => {
    mockFindFirst.mockResolvedValue({ id: 'c1' } as never)
    mockUpdate.mockReturnValue(makeChain(undefined) as never)
    const ok = await renameChat('c1', 'ws1', 'u1', 'New title')
    expect(ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
  })
})

describe('deleteChat — cross-user isolation', () => {
  it('refuses to delete a chat owned by another user', async () => {
    mockFindFirst.mockResolvedValue(undefined)
    const ok = await deleteChat('their-chat', 'ws1', 'attacker')
    expect(ok).toBe(false)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('deletes when the caller owns the chat', async () => {
    mockFindFirst.mockResolvedValue({ id: 'c1' } as never)
    mockDelete.mockReturnValue(makeChain(undefined) as never)
    const ok = await deleteChat('c1', 'ws1', 'u1')
    expect(ok).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
  })
})

describe('listChats — scoping', () => {
  it('filters by workspaceId and userId with no search term', async () => {
    mockSelect.mockReturnValue(makeChain([]) as never)
    await listChats('ws1', 'u1')
    const calledWith = mockEq.mock.calls.map(([col, val]) => [col, val])
    expect(calledWith).toContainEqual([chats.workspaceId, 'ws1'])
    expect(calledWith).toContainEqual([chats.userId, 'u1'])
  })

  it('still scopes by workspaceId/userId when a search term is given', async () => {
    mockSelect.mockReturnValue(makeChain([]) as never)
    await listChats('ws1', 'u1', 'invoice')
    const calledWith = mockEq.mock.calls.map(([col, val]) => [col, val])
    expect(calledWith).toContainEqual([chats.workspaceId, 'ws1'])
    expect(calledWith).toContainEqual([chats.userId, 'u1'])
  })
})
