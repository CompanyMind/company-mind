import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db/client'
import { getOwner } from './require-owner'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db/client', () => ({
  db: { query: { memberships: { findFirst: vi.fn() } } },
}))

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockFindFirst = vi.mocked(db.query.memberships.findFirst)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getOwner', () => {
  it('returns null when there is no session', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const result = await getOwner()
    expect(result).toBeNull()
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns null when the caller is a member, not an owner', async () => {
    mockGetCurrentUser.mockResolvedValue({
      user: { id: 'u1' } as never,
      workspace: { id: 'w1' } as never,
    })
    mockFindFirst.mockResolvedValue({ userId: 'u1', workspaceId: 'w1', role: 'member' } as never)

    const result = await getOwner()
    expect(result).toBeNull()
  })

  it('returns null when there is no membership row at all', async () => {
    mockGetCurrentUser.mockResolvedValue({
      user: { id: 'u1' } as never,
      workspace: { id: 'w1' } as never,
    })
    mockFindFirst.mockResolvedValue(undefined)

    const result = await getOwner()
    expect(result).toBeNull()
  })

  it('returns userId + workspaceId when the caller is an owner', async () => {
    mockGetCurrentUser.mockResolvedValue({
      user: { id: 'u1' } as never,
      workspace: { id: 'w1' } as never,
    })
    mockFindFirst.mockResolvedValue({ userId: 'u1', workspaceId: 'w1', role: 'owner' } as never)

    const result = await getOwner()
    expect(result).toEqual({ userId: 'u1', workspaceId: 'w1' })
  })
})
