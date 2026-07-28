/**
 * Chat history is per-person, not per-workspace.
 *
 * This behaviour was already correct when the control plane was audited — every
 * read and write in lib/chat.ts scopes to (workspaceId, userId), and the routes
 * pass the caller's own id from the session. Nothing here changes production
 * code; the tests exist so a later refactor cannot quietly widen it to
 * "everyone in the workspace", which is what the equivalent document listing had
 * done and nobody noticed.
 *
 * The load-bearing assertion is that the user id comes from the SESSION and a
 * client-supplied one is ignored — scoping to a caller-provided id would look
 * identical in a passing test that only checked "some user id was used".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from '@/lib/auth/session-store'
import { fakeSession } from '@/test/session'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { listChats, createChat, getChatMessages, renameChat, deleteChat } from '@/lib/chat'
import { GET as chatsGET, POST as chatsPOST } from '@/app/api/chats/route'
import {
  GET as chatGET,
  PATCH as chatPATCH,
  DELETE as chatDELETE,
} from '@/app/api/chats/[id]/route'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn() }))
vi.mock('@/lib/chat', () => ({
  listChats: vi.fn(),
  createChat: vi.fn(),
  getChatMessages: vi.fn(),
  renameChat: vi.fn(),
  deleteChat: vi.fn(),
}))

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockVerifyCsrf = vi.mocked(verifyCsrf)

const ALICE = fakeSession({ user: { id: 'alice' } as Session['user'], role: 'member' })

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.resetAllMocks()
  mockVerifyCsrf.mockResolvedValue(true)
  mockGetCurrentUser.mockResolvedValue(ALICE)
})

describe('chat history is scoped to the signed-in person', () => {
  it('lists only the caller’s own chats', async () => {
    vi.mocked(listChats).mockResolvedValue([])
    await chatsGET(new NextRequest('http://test/api/chats'))
    expect(listChats).toHaveBeenCalledWith('w1', 'alice', undefined)
  })

  it('ignores a user id supplied by the client when listing', async () => {
    vi.mocked(listChats).mockResolvedValue([])
    // A crafted query string must not change whose history is returned.
    await chatsGET(new NextRequest('http://test/api/chats?userId=bob&user_id=bob'))
    expect(listChats).toHaveBeenCalledWith('w1', 'alice', undefined)
    expect(listChats).not.toHaveBeenCalledWith('w1', 'bob', expect.anything())
  })

  it('creates chats owned by the caller', async () => {
    vi.mocked(createChat).mockResolvedValue({ id: 'c1' })
    await chatsPOST(new Request('http://test/api/chats', { method: 'POST', body: '{}' }))
    expect(createChat).toHaveBeenCalledWith('w1', 'alice')
  })

  it('404s when reading a chat belonging to someone else', async () => {
    // chatOwned() fails for Bob's chat, so the lib returns null.
    vi.mocked(getChatMessages).mockResolvedValue(null)
    const res = await chatGET(new Request('http://test/x'), params('bobs-chat'))
    expect(res.status).toBe(404)
    expect(getChatMessages).toHaveBeenCalledWith('bobs-chat', 'w1', 'alice')
  })

  it('404s when renaming a chat belonging to someone else', async () => {
    vi.mocked(renameChat).mockResolvedValue(false)
    const res = await chatPATCH(
      new Request('http://test/x', { method: 'PATCH', body: JSON.stringify({ title: 'mine now' }) }),
      params('bobs-chat'),
    )
    expect(res.status).toBe(404)
    expect(renameChat).toHaveBeenCalledWith('bobs-chat', 'w1', 'alice', 'mine now')
  })

  it('404s when deleting a chat belonging to someone else', async () => {
    vi.mocked(deleteChat).mockResolvedValue(false)
    const res = await chatDELETE(new Request('http://test/x', { method: 'DELETE' }), params('bobs-chat'))
    expect(res.status).toBe(404)
    expect(deleteChat).toHaveBeenCalledWith('bobs-chat', 'w1', 'alice')
  })

  it('is not vacuous: the caller’s own chat succeeds through the same routes', async () => {
    vi.mocked(getChatMessages).mockResolvedValue([])
    vi.mocked(renameChat).mockResolvedValue(true)
    vi.mocked(deleteChat).mockResolvedValue(true)

    expect((await chatGET(new Request('http://test/x'), params('alices-chat'))).status).toBe(200)
    expect(
      (
        await chatPATCH(
          new Request('http://test/x', { method: 'PATCH', body: JSON.stringify({ title: 'ok' }) }),
          params('alices-chat'),
        )
      ).status,
    ).toBe(200)
    expect(
      (await chatDELETE(new Request('http://test/x', { method: 'DELETE' }), params('alices-chat')))
        .status,
    ).toBe(200)
  })
})
