import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import { getGraph, getTopic, listFindings, rebuildGraph, dismissFinding } from '@/lib/graph'
import { GET as graphGET } from '@/app/api/graph/route'
import { GET as topicGET } from '@/app/api/graph/topic/[id]/route'
import { GET as findingsGET } from '@/app/api/graph/findings/route'
import { POST as rebuildPOST } from '@/app/api/graph/rebuild/route'
import { POST as dismissPOST } from '@/app/api/graph/findings/[id]/dismiss/route'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth/require-owner', () => ({ getOwner: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn() }))
vi.mock('@/lib/graph', () => ({
  getGraph: vi.fn(),
  getTopic: vi.fn(),
  listFindings: vi.fn(),
  rebuildGraph: vi.fn(),
  dismissFinding: vi.fn(),
}))

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockGetOwner = vi.mocked(getOwner)
const mockVerifyCsrf = vi.mocked(verifyCsrf)
const mockGetGraph = vi.mocked(getGraph)
const mockGetTopic = vi.mocked(getTopic)
const mockListFindings = vi.mocked(listFindings)
const mockRebuildGraph = vi.mocked(rebuildGraph)
const mockDismissFinding = vi.mocked(dismissFinding)

// role is 'member' deliberately: these routes gate on getOwner(), which is mocked
// per-test below. Defaulting the session's own role to the least privilege means
// a route that starts reading auth.role directly cannot silently pass as owner.
const AUTHED = { user: { id: 'u1' } as never, workspace: { id: 'w1' } as never, role: 'member' as const }
const OWNER = { userId: 'u1', workspaceId: 'w1' }

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/graph', () => {
  it('returns 401 when there is no session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const res = await graphGET(new NextRequest('http://test/api/graph'))
    expect(res.status).toBe(401)
    expect(mockGetOwner).not.toHaveBeenCalled()
    expect(mockGetGraph).not.toHaveBeenCalled()
  })

  it('returns 403 when authenticated but not an owner', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(null)
    const res = await graphGET(new NextRequest('http://test/api/graph'))
    expect(res.status).toBe(403)
    expect(mockGetGraph).not.toHaveBeenCalled()
  })

  it('delegates to getGraph as role=owner and forwards as_group for an owner', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockGetGraph.mockResolvedValue({ topics: [], job: null })
    const res = await graphGET(new NextRequest('http://test/api/graph?as_group=grp-9'))
    expect(res.status).toBe(200)
    expect(mockGetGraph).toHaveBeenCalledWith('w1', 'u1', 'owner', 'grp-9')
  })
})

describe('GET /api/graph/topic/[id]', () => {
  it('returns 403 for a non-owner', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(null)
    const res = await topicGET(new NextRequest('http://test/api/graph/topic/t1'), {
      params: Promise.resolve({ id: 't1' }),
    })
    expect(res.status).toBe(403)
    expect(mockGetTopic).not.toHaveBeenCalled()
  })

  it('delegates to getTopic for an owner', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockGetTopic.mockResolvedValue({ nodes: [] })
    const res = await topicGET(new NextRequest('http://test/api/graph/topic/t1'), {
      params: Promise.resolve({ id: 't1' }),
    })
    expect(res.status).toBe(200)
    expect(mockGetTopic).toHaveBeenCalledWith('w1', 't1', 'u1', 'owner', undefined)
  })
})

describe('GET /api/graph/findings', () => {
  it('returns 403 for a non-owner', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(null)
    const res = await findingsGET(new NextRequest('http://test/api/graph/findings'))
    expect(res.status).toBe(403)
    expect(mockListFindings).not.toHaveBeenCalled()
  })

  it('delegates to listFindings with kind for an owner', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockListFindings.mockResolvedValue([])
    const res = await findingsGET(new NextRequest('http://test/api/graph/findings?kind=orphan'))
    expect(res.status).toBe(200)
    expect(mockListFindings).toHaveBeenCalledWith('w1', 'u1', 'owner', undefined, 'orphan')
  })
})

describe('POST /api/graph/rebuild', () => {
  it('returns 403 for a non-owner without checking csrf', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(null)
    const res = await rebuildPOST(new Request('http://test/api/graph/rebuild', { method: 'POST' }))
    expect(res.status).toBe(403)
    expect(mockRebuildGraph).not.toHaveBeenCalled()
  })

  it('returns 403 bad csrf for an owner with no/invalid csrf token', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockVerifyCsrf.mockResolvedValue(false)
    const res = await rebuildPOST(new Request('http://test/api/graph/rebuild', { method: 'POST' }))
    expect(res.status).toBe(403)
    expect(mockRebuildGraph).not.toHaveBeenCalled()
  })

  it('delegates to rebuildGraph for an owner with valid csrf', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockVerifyCsrf.mockResolvedValue(true)
    mockRebuildGraph.mockResolvedValue(null)
    const res = await rebuildPOST(new Request('http://test/api/graph/rebuild', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(mockRebuildGraph).toHaveBeenCalledWith('w1')
  })
})

describe('POST /api/graph/findings/[id]/dismiss', () => {
  it('returns 403 for a non-owner', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(null)
    const res = await dismissPOST(new Request('http://test/api/graph/findings/f1/dismiss', { method: 'POST' }), {
      params: Promise.resolve({ id: 'f1' }),
    })
    expect(res.status).toBe(403)
    expect(mockDismissFinding).not.toHaveBeenCalled()
  })

  it('returns 403 bad csrf for an owner with invalid csrf token', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockVerifyCsrf.mockResolvedValue(false)
    const res = await dismissPOST(new Request('http://test/api/graph/findings/f1/dismiss', { method: 'POST' }), {
      params: Promise.resolve({ id: 'f1' }),
    })
    expect(res.status).toBe(403)
    expect(mockDismissFinding).not.toHaveBeenCalled()
  })

  it('returns 404 when dismissFinding reports not-found', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockVerifyCsrf.mockResolvedValue(true)
    mockDismissFinding.mockResolvedValue(false)
    const res = await dismissPOST(new Request('http://test/api/graph/findings/missing/dismiss', { method: 'POST' }), {
      params: Promise.resolve({ id: 'missing' }),
    })
    expect(res.status).toBe(404)
  })

  it('delegates to dismissFinding for an owner with valid csrf', async () => {
    mockGetCurrentUser.mockResolvedValue(AUTHED)
    mockGetOwner.mockResolvedValue(OWNER)
    mockVerifyCsrf.mockResolvedValue(true)
    mockDismissFinding.mockResolvedValue(true)
    const res = await dismissPOST(new Request('http://test/api/graph/findings/f1/dismiss', { method: 'POST' }), {
      params: Promise.resolve({ id: 'f1' }),
    })
    expect(res.status).toBe(200)
    expect(mockDismissFinding).toHaveBeenCalledWith('w1', 'f1')
  })
})
