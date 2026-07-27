/**
 * Download hands over a whole file, so the route must ask the access model on
 * behalf of the CALLER — not the workspace.
 *
 * This is the same class of bug that once leaked every filename to every
 * member: the surface was correct about which workspace it was in and silent
 * about who was asking. A test that only checked "a member gets their own
 * document" would pass with the caller hardcoded to an owner, so the assertion
 * here is on the arguments getDocument actually receives.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getDocument } from '@/lib/documents'
import { readFile } from '@/lib/storage'
import { GET as fileGET } from '@/app/api/documents/[id]/file/route'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/documents', () => ({ getDocument: vi.fn() }))
vi.mock('@/lib/storage', () => ({ readFile: vi.fn() }))

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockGetDocument = vi.mocked(getDocument)
const mockReadFile = vi.mocked(readFile)

const MEMBER = {
  user: { id: 'u1' } as never,
  workspace: { id: 'w1' } as never,
  role: 'member' as const,
}
const DOC = {
  id: 'd1',
  filename: 'handbook.pdf',
  mime: 'application/pdf',
  bytes: 3,
  status: 'indexed',
  error: null,
  createdAt: null,
  groupIds: [],
  folderId: null,
  storageKey: 'w1/abc-handbook.pdf',
}

const call = () => fileGET(new Request('http://test/x'), { params: Promise.resolve({ id: 'd1' }) })

beforeEach(() => vi.resetAllMocks())

describe('GET /api/documents/[id]/file', () => {
  it('asks the access model as the caller, with the session’s workspace', async () => {
    mockGetCurrentUser.mockResolvedValue(MEMBER)
    mockGetDocument.mockResolvedValue(DOC)
    mockReadFile.mockResolvedValue(Buffer.from('pdf'))

    await call()

    // Workspace from the session, never the request; identity AND role passed
    // through, because the engine's predicate needs both.
    expect(mockGetDocument).toHaveBeenCalledWith('w1', { userId: 'u1', role: 'member' }, 'd1')
  })

  it('404s a document the caller may not see, and never touches the disk', async () => {
    mockGetCurrentUser.mockResolvedValue(MEMBER)
    mockGetDocument.mockResolvedValue(null)

    const res = await call()

    expect(res.status).toBe(404)
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it('401s an anonymous caller before looking anything up', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const res = await call()

    expect(res.status).toBe(401)
    expect(mockGetDocument).not.toHaveBeenCalled()
  })

  it('serves the bytes as a download, never inline', async () => {
    mockGetCurrentUser.mockResolvedValue(MEMBER)
    mockGetDocument.mockResolvedValue(DOC)
    mockReadFile.mockResolvedValue(Buffer.from('pdf'))

    const res = await call()

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('pdf')
    expect(mockReadFile).toHaveBeenCalledWith('w1/abc-handbook.pdf')
    // A customer upload rendered inline would run on our own origin, against
    // the session cookie.
    expect(res.headers.get('content-disposition')).toMatch(/^attachment;/)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    // Never cached by a shared proxy — this is one person's private document.
    expect(res.headers.get('cache-control')).toContain('private')
  })

  it('reports missing bytes as a server fault, not as a missing document', async () => {
    mockGetCurrentUser.mockResolvedValue(MEMBER)
    mockGetDocument.mockResolvedValue(DOC)
    mockReadFile.mockRejectedValue(Object.assign(new Error('nope'), { code: 'ENOENT' }))

    // 404 here would send an owner hunting for a document that is listed right
    // in front of them; the record exists and the storage volume is the problem.
    expect((await call()).status).toBe(500)
  })
})
