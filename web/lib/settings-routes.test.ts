/**
 * The two Settings routes that are not /api/me.
 *
 * Renaming a workspace is an owner action. It is deliberately NOT added to
 * control-plane-gates.test.ts: that table's contract is "routes that change WHO
 * SEES WHAT", and a name changes nothing about access. Widening it to mean
 * "owner-ish routes" would blunt the one test whose meaning is currently exact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { renameWorkspace } from '@/lib/workspace'
import { deleteAllChats } from '@/lib/chat'
import { PATCH as workspacePATCH } from '@/app/api/workspace/route'
import { DELETE as chatsDELETE } from '@/app/api/chats/route'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth/require-owner', () => ({ getOwner: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(), issueCsrf: vi.fn() }))
vi.mock('@/lib/workspace', () => ({ renameWorkspace: vi.fn(), MAX_WORKSPACE_NAME: 120 }))
vi.mock('@/lib/chat', () => ({
  listChats: vi.fn(),
  createChat: vi.fn(),
  deleteAllChats: vi.fn(),
}))

const SESSION = {
  sessionId: 'sess-a',
  user: { id: 'user-a' },
  workspace: { id: 'firm-a' },
  role: 'member',
} as unknown as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

const req = (method: string, body?: unknown) =>
  new Request('http://test/x', { method, body: body === undefined ? undefined : JSON.stringify(body) })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(verifyCsrf).mockResolvedValue(true)
})

describe('PATCH /api/workspace', () => {
  it('403s for a member, and the write does not land', async () => {
    vi.mocked(getOwner).mockResolvedValue(null)
    const res = await workspacePATCH(req('PATCH', { name: 'Hijacked' }))
    // 403 rather than 404: a member knows their workspace exists, they simply
    // may not rename it.
    expect(res.status).toBe(403)
    expect(renameWorkspace).not.toHaveBeenCalled()
  })

  it('403s without a valid CSRF token, without writing', async () => {
    vi.mocked(getOwner).mockResolvedValue({ userId: 'owner-a', workspaceId: 'firm-a' })
    vi.mocked(verifyCsrf).mockResolvedValue(false)
    expect((await workspacePATCH(req('PATCH', { name: 'Acme' }))).status).toBe(403)
    expect(renameWorkspace).not.toHaveBeenCalled()
  })

  it('renames the SESSION workspace, ignoring an id forged into the body', async () => {
    vi.mocked(getOwner).mockResolvedValue({ userId: 'owner-a', workspaceId: 'firm-a' })
    const res = await workspacePATCH(
      req('PATCH', { id: 'firm-b', workspaceId: 'firm-b', name: 'Acme Bank' }),
    )
    expect(res.status).toBe(200)
    expect(renameWorkspace).toHaveBeenCalledWith('firm-a', 'Acme Bank')
  })

  it('trims, and 400s on a blank or over-long name without writing', async () => {
    vi.mocked(getOwner).mockResolvedValue({ userId: 'owner-a', workspaceId: 'firm-a' })
    expect((await workspacePATCH(req('PATCH', { name: '   ' }))).status).toBe(400)
    expect((await workspacePATCH(req('PATCH', { name: 'x'.repeat(121) }))).status).toBe(400)
    expect(renameWorkspace).not.toHaveBeenCalled()

    await workspacePATCH(req('PATCH', { name: '  Acme  ' }))
    expect(renameWorkspace).toHaveBeenCalledWith('firm-a', 'Acme')
  })
})

describe('DELETE /api/chats', () => {
  it('401s when signed out, without deleting', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await chatsDELETE(req('DELETE'))).status).toBe(401)
    expect(deleteAllChats).not.toHaveBeenCalled()
  })

  it('403s without a valid CSRF token, without deleting', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION)
    vi.mocked(verifyCsrf).mockResolvedValue(false)
    expect((await chatsDELETE(req('DELETE'))).status).toBe(403)
    expect(deleteAllChats).not.toHaveBeenCalled()
  })

  it('deletes only the caller’s own chats, ignoring ids in the body', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(SESSION)
    vi.mocked(deleteAllChats).mockResolvedValue(3)
    const res = await chatsDELETE(req('DELETE', { userId: 'victim', workspaceId: 'firm-b' }))
    expect(res.status).toBe(200)
    expect(deleteAllChats).toHaveBeenCalledWith('firm-a', 'user-a')
    expect(await res.json()).toEqual({ ok: true, count: 3 })
  })
})
