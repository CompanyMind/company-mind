import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSession } from '@/test/session'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from './require-owner'

// getOwner no longer queries `memberships` itself: validateSessionToken already
// fetches that row to resolve the workspace, so the role now rides along on the
// session. There is nothing left here to mock but the session.
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))

const mockGetCurrentUser = vi.mocked(getCurrentUser)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getOwner', () => {
  it('returns null when there is no session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    expect(await getOwner()).toBeNull()
  })

  it('returns null when the caller is a member, not an owner', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeSession({ role: 'member' }))
    expect(await getOwner()).toBeNull()
  })

  it('returns userId + workspaceId when the caller is an owner', async () => {
    mockGetCurrentUser.mockResolvedValue(fakeSession({ role: 'owner' }))
    expect(await getOwner()).toEqual({ userId: 'u1', workspaceId: 'w1' })
  })

  // A session with no membership row can no longer reach getOwner at all —
  // validateSessionToken returns null for it, so the caller is unauthenticated
  // rather than un-owned. Asserted here so that guarantee is not quietly lost.
  it('treats a session-less caller as not-owner regardless of workspace', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    expect(await getOwner()).toBeNull()
  })
})
