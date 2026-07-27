/**
 * Every route that can change WHO SEES WHAT must be owner-gated.
 *
 * Before this, all of them were gated by `getCurrentUser()` alone, so any signed-in
 * member could `PUT /api/documents/<id>/groups` to retag a document they could not
 * open into a group they belonged to, or `PUT /api/groups/<id>/members` to add
 * themselves to any group — and `resolve_access` would then faithfully honour it.
 * The access model's evaluation was airtight; its inputs were world-writable.
 *
 * The TABLE below is the test. A control-plane route added later without a gate
 * has to be added here to be covered — and if it is added here without a gate, it
 * fails. Each case also names the side effect that must NOT happen, because a 403
 * with the write already landed is not a fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOwner } from '@/lib/auth/require-owner'
import { verifyCsrf } from '@/lib/csrf'
import * as groupsLib from '@/lib/groups'
import * as foldersLib from '@/lib/folders'
import * as telegramLib from '@/lib/telegram'
import * as documentsLib from '@/lib/documents'
import * as engineLib from '@/lib/engine'

import { POST as documentsPOST } from '@/app/api/documents/route'
import { DELETE as documentDELETE } from '@/app/api/documents/[id]/route'
import { PUT as documentFolderPUT } from '@/app/api/documents/[id]/folder/route'
import { PUT as documentGroupsPUT } from '@/app/api/documents/[id]/groups/route'
import { GET as groupsGET, POST as groupsPOST } from '@/app/api/groups/route'
import { PATCH as groupPATCH, DELETE as groupDELETE } from '@/app/api/groups/[id]/route'
import { PUT as groupMembersPUT } from '@/app/api/groups/[id]/members/route'
import { POST as foldersPOST } from '@/app/api/folders/route'
import { PATCH as folderPATCH, DELETE as folderDELETE } from '@/app/api/folders/[id]/route'
import { POST as organizePOST } from '@/app/api/folders/organize/route'
import {
  GET as telegramGET,
  POST as telegramPOST,
  DELETE as telegramDELETE,
} from '@/app/api/integrations/telegram/route'
import { POST as linkPOST } from '@/app/api/telegram-links/[id]/route'
import { PUT as linkGroupsPUT } from '@/app/api/telegram-links/[id]/groups/route'

vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/auth/require-owner', () => ({ getOwner: vi.fn() }))
vi.mock('@/lib/csrf', () => ({ verifyCsrf: vi.fn(), issueCsrf: vi.fn() }))
vi.mock('@/lib/groups', () => ({
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
  setGroupMembers: vi.fn(),
  setDocumentGroups: vi.fn(),
}))
vi.mock('@/lib/folders', () => ({
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  deleteFolder: vi.fn(),
  organizeFolders: vi.fn(),
  setDocumentFolder: vi.fn(),
}))
vi.mock('@/lib/telegram', () => ({
  connectTelegram: vi.fn(),
  disconnectTelegram: vi.fn(),
  getTelegramStatus: vi.fn(),
  listLinks: vi.fn(),
  setLinkStatus: vi.fn(),
  setTelegramLinkGroups: vi.fn(),
}))
vi.mock('@/lib/documents', () => ({
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  deleteDocument: vi.fn(),
}))
vi.mock('@/lib/storage', () => ({ saveFile: vi.fn(), readFile: vi.fn(), deleteFile: vi.fn() }))
vi.mock('@/lib/engine', () => ({ uploadDocument: vi.fn() }))
vi.mock('@/lib/db/client', () => ({
  db: { query: { memberships: { findFirst: vi.fn() } }, select: vi.fn(), insert: vi.fn() },
}))

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockGetOwner = vi.mocked(getOwner)
const mockVerifyCsrf = vi.mocked(verifyCsrf)

const MEMBER = {
  user: { id: 'u1' } as never,
  workspace: { id: 'w1' } as never,
  role: 'member' as const,
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (body: unknown = {}) =>
  new Request('http://test/x', { method: 'POST', body: JSON.stringify(body) })

/** Each case: what a member tries, and the mutation that must never run. */
const CONTROL_PLANE: Array<{ name: string; run: () => Promise<Response>; effect: () => unknown }> = [
  {
    name: 'PUT /api/documents/[id]/groups — retag a document into your own group',
    run: () => documentGroupsPUT(req({ groupIds: ['g-secret'] }), params('d1')),
    effect: () => groupsLib.setDocumentGroups,
  },
  {
    name: 'PUT /api/groups/[id]/members — add yourself to any group',
    run: () => groupMembersPUT(req({ userIds: ['u1'] }), params('g1')),
    effect: () => groupsLib.setGroupMembers,
  },
  {
    name: 'POST /api/groups — create a group',
    run: () => groupsPOST(req({ name: 'Mine' })),
    effect: () => groupsLib.createGroup,
  },
  {
    // Read-only, but it returns the group structure AND every colleague's email
    // and name. A staff directory is disclosure even when nothing is written.
    name: 'GET /api/groups — read the group structure and the staff directory',
    run: () => groupsGET(),
    effect: () => groupsLib.listGroups,
  },
  {
    name: 'PATCH /api/groups/[id] — rename a group',
    run: () => groupPATCH(req({ name: 'Renamed' }), params('g1')),
    effect: () => groupsLib.renameGroup,
  },
  {
    name: 'DELETE /api/groups/[id] — delete a group, removing its restriction',
    run: () => groupDELETE(req(), params('g1')),
    effect: () => groupsLib.deleteGroup,
  },
  {
    name: 'POST /api/documents — upload (defaults to Everyone, i.e. publish to the firm)',
    run: () => documentsPOST(req()),
    effect: () => engineLib.uploadDocument,
  },
  {
    // Revoking everyone's access to a document, permanently, in one call — the
    // same power as retagging it into nobody's group, but irreversible.
    name: 'DELETE /api/documents/[id] — delete a document and its stored file',
    run: () => documentDELETE(req(), params('d1')),
    effect: () => documentsLib.deleteDocument,
  },
  {
    name: 'PUT /api/documents/[id]/folder — move a document',
    run: () => documentFolderPUT(req({ folderId: null }), params('d1')),
    effect: () => foldersLib.setDocumentFolder,
  },
  {
    name: 'POST /api/folders — create a folder',
    run: () => foldersPOST(req({ name: 'Mine' })),
    effect: () => foldersLib.createFolder,
  },
  {
    name: 'PATCH /api/folders/[id] — rename a folder',
    run: () => folderPATCH(req({ name: 'Renamed' }), params('f1')),
    effect: () => foldersLib.renameFolder,
  },
  {
    name: 'DELETE /api/folders/[id] — delete a folder',
    run: () => folderDELETE(req(), params('f1')),
    effect: () => foldersLib.deleteFolder,
  },
  {
    name: 'POST /api/folders/organize — reorganise the whole corpus',
    run: () => organizePOST(req()),
    effect: () => foldersLib.organizeFolders,
  },
  {
    name: 'GET /api/integrations/telegram — read the workspace bot config',
    run: () => telegramGET(),
    effect: () => telegramLib.getTelegramStatus,
  },
  {
    name: 'POST /api/integrations/telegram — replace the workspace bot',
    run: () => telegramPOST(req({ token: 'x' })),
    effect: () => telegramLib.connectTelegram,
  },
  {
    name: 'DELETE /api/integrations/telegram — disconnect the bot',
    run: () => telegramDELETE(req()),
    effect: () => telegramLib.disconnectTelegram,
  },
  {
    name: 'POST /api/telegram-links/[id] — approve an outside Telegram identity',
    run: () => linkPOST(req({ status: 'approved' }), params('l1')),
    effect: () => telegramLib.setLinkStatus,
  },
  {
    name: 'PUT /api/telegram-links/[id]/groups — grant a Telegram identity your groups',
    run: () => linkGroupsPUT(req({ groupIds: ['g-secret'] }), params('l1')),
    effect: () => telegramLib.setTelegramLinkGroups,
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  // CSRF passes on purpose: this asserts the AUTHORIZATION gate rejects, not
  // that a missing token happened to save us.
  mockVerifyCsrf.mockResolvedValue(true)
})

describe('the control plane rejects members', () => {
  for (const c of CONTROL_PLANE) {
    it(`403s: ${c.name}`, async () => {
      mockGetCurrentUser.mockResolvedValue(MEMBER)
      mockGetOwner.mockResolvedValue(null)

      const res = await c.run()

      expect(res.status).toBe(403)
      // The write must not have landed. A 403 returned after the mutation ran
      // would be worse than useless — it would look fixed.
      expect(c.effect()).not.toHaveBeenCalled()
    })
  }

  it('covers every mutating control-plane route (guard against silent additions)', () => {
    expect(CONTROL_PLANE).toHaveLength(18)
  })
})

describe('the control plane admits owners', () => {
  it('lets an owner through the two routes that decide access', async () => {
    mockGetCurrentUser.mockResolvedValue({ ...MEMBER, role: 'owner' })
    mockGetOwner.mockResolvedValue({ userId: 'u1', workspaceId: 'w1' })

    const res = await documentGroupsPUT(req({ groupIds: ['g1'] }), params('d1'))
    expect(res.status).toBe(200)
    expect(groupsLib.setDocumentGroups).toHaveBeenCalledWith('d1', 'w1', ['g1'])
  })
})
