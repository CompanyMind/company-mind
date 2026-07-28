import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSource } from './source'
import { getTopic, dismissFinding } from './graph'
import { renameFolder, deleteFolder, setDocumentFolder } from './folders'
import { renameGroup, deleteGroup, setGroupMembers, setDocumentGroups } from './groups'
import { setLinkStatus, setTelegramLinkGroups } from './telegram'
import { getDocument, deleteDocument } from './documents'

/**
 * Every id below arrives as a Next route parameter, and Next decodes route
 * parameters before handing them over. `new URL()` and `fetch()` both normalise
 * dot segments, so an un-encoded `../usage/summary` used to leave the endpoint
 * it was meant for and land on another one — carrying `x-engine-secret`, which
 * authorises the whole internal API.
 *
 * The assertion is deliberately about the RESOLVED url (what fetch actually
 * requests), not the string that was passed in: a `..` that survives to the
 * wire is the bug, however it got there.
 */
const ORIGINAL_ENV = { ...process.env }
const TRAVERSAL = '../usage/summary'

beforeEach(() => {
  process.env.ENGINE_BASE_URL = 'http://engine.test'
  process.env.ENGINE_INTERNAL_SECRET = 'secret-123'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

function ok(body: unknown = {}): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

/** The URL fetch was actually called with, fully resolved the way fetch does. */
function requestedUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  const arg = fetchMock.mock.calls[0][0]
  return new URL(String(arg)).href
}

const CASES: { name: string; prefix: string; run: () => Promise<unknown> }[] = [
  {
    name: 'getSource (member-reachable, /s/[chunkId])',
    prefix: 'http://engine.test/source/',
    run: () => getSource(TRAVERSAL, 'ws1', 'u1', 'member'),
  },
  {
    name: 'getTopic',
    prefix: 'http://engine.test/graph/topic/',
    run: () => getTopic('ws1', TRAVERSAL, 'u1', 'owner'),
  },
  {
    name: 'dismissFinding',
    prefix: 'http://engine.test/graph/findings/',
    run: () => dismissFinding('ws1', TRAVERSAL),
  },
  {
    name: 'renameFolder',
    prefix: 'http://engine.test/folders/',
    run: () => renameFolder('ws1', TRAVERSAL, 'x'),
  },
  {
    name: 'deleteFolder',
    prefix: 'http://engine.test/folders/',
    run: () => deleteFolder('ws1', TRAVERSAL),
  },
  {
    name: 'setDocumentFolder',
    prefix: 'http://engine.test/documents/',
    run: () => setDocumentFolder(TRAVERSAL, 'ws1', null),
  },
  {
    name: 'renameGroup',
    prefix: 'http://engine.test/groups/',
    run: () => renameGroup('ws1', TRAVERSAL, 'x'),
  },
  {
    name: 'deleteGroup',
    prefix: 'http://engine.test/groups/',
    run: () => deleteGroup('ws1', TRAVERSAL),
  },
  {
    name: 'setGroupMembers',
    prefix: 'http://engine.test/groups/',
    run: () => setGroupMembers(TRAVERSAL, 'ws1', []),
  },
  {
    name: 'setDocumentGroups',
    prefix: 'http://engine.test/documents/',
    run: () => setDocumentGroups(TRAVERSAL, 'ws1', []),
  },
  {
    name: 'getDocument (member-reachable, download)',
    prefix: 'http://engine.test/documents/',
    run: () => getDocument('ws1', { userId: 'u1', role: 'member' }, TRAVERSAL),
  },
  {
    name: 'deleteDocument',
    prefix: 'http://engine.test/documents/',
    run: () => deleteDocument('ws1', TRAVERSAL),
  },
  {
    name: 'setLinkStatus',
    prefix: 'http://engine.test/telegram/links/',
    run: () => setLinkStatus(TRAVERSAL, 'ws1', 'approve'),
  },
  {
    name: 'setTelegramLinkGroups',
    prefix: 'http://engine.test/telegram/links/',
    run: () => setTelegramLinkGroups(TRAVERSAL, 'ws1', []),
  },
]

describe('a traversing id cannot escape its engine endpoint', () => {
  for (const c of CASES) {
    it(`${c.name} stays under ${c.prefix}`, async () => {
      // A body generous enough for every mapper under test; the assertion is
      // on the URL, so the shape only has to keep the callee from throwing.
      const fetchMock = vi.fn().mockResolvedValue(
        ok({
          group_ids: [],
          nodes: [],
          links: [],
          storage_key: 'k',
          document: { id: 'd', filename: 'f', mime: 'text/plain', bytes: 0, status: 'indexed', error: null, created_at: null, storage_key: 'k' },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      await c.run()

      const url = requestedUrl(fetchMock)
      expect(url.startsWith(c.prefix)).toBe(true)
      // The specific endpoint the traversal was aiming at.
      expect(url).not.toContain('/usage/summary')
      // And no dot-segment survived anywhere in the path.
      expect(new URL(url).pathname.split('/')).not.toContain('..')
    })
  }
})

describe('ordinary ids are still passed through readably', () => {
  it('leaves a uuid untouched', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}))
    vi.stubGlobal('fetch', fetchMock)
    await getSource('7a1f0c2e-0000-4000-8000-000000000001', 'ws1', 'u1', 'member')
    expect(requestedUrl(fetchMock)).toContain('/source/7a1f0c2e-0000-4000-8000-000000000001')
  })
})
