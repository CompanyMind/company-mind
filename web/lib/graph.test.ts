import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGraph, getTopic, listFindings, rebuildGraph, dismissFinding } from './graph'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.ENGINE_BASE_URL = 'http://engine.test'
  process.env.ENGINE_INTERNAL_SECRET = 'secret-123'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('getGraph', () => {
  it('maps doc_count -> docCount and computed_at -> computedAt, and omits as_group when unset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        topics: [{ id: 't1', label: 'Billing', keywords: ['invoice', 'payment'], x: 1.5, y: -2.25, doc_count: 7 }],
        job: { id: 'j1', status: 'done', error: null, computed_at: '2026-07-18T00:00:00Z' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getGraph('ws1', 'u1', 'member', undefined)

    expect(result.topics).toEqual([
      { id: 't1', label: 'Billing', keywords: ['invoice', 'payment'], x: 1.5, y: -2.25, docCount: 7 },
    ])
    expect(result.job).toEqual({ id: 'j1', status: 'done', error: null, computedAt: '2026-07-18T00:00:00Z' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine.test/graph?workspace_id=ws1&user_id=u1&role=member')
    expect(url).not.toContain('as_group')
    expect(init.headers['x-engine-secret']).toBe('secret-123')
    expect(init.cache).toBe('no-store')
  })

  it('forwards as_group in the query string when set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ topics: [], job: null }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getGraph('ws1', 'u1', 'owner', 'grp-9')

    expect(result.job).toBeNull()
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine.test/graph?workspace_id=ws1&user_id=u1&role=owner&as_group=grp-9')
  })

  it('throws when the engine responds non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    await expect(getGraph('ws1', 'u1', 'member', undefined)).rejects.toThrow('500')
  })
})

describe('getTopic', () => {
  it('maps exposure_score/is_orphan/last_retrieved_at to camelCase', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        nodes: [
          { id: 'd1', filename: 'a.pdf', exposure_score: 0.42, is_orphan: false, last_retrieved_at: '2026-07-01T00:00:00Z' },
          { id: 'd2', filename: 'b.pdf', exposure_score: 0, is_orphan: true, last_retrieved_at: null },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getTopic('ws1', 't1', 'u1', 'member', 'grp-5')

    expect(result.nodes).toEqual([
      { id: 'd1', filename: 'a.pdf', exposureScore: 0.42, isOrphan: false, lastRetrievedAt: '2026-07-01T00:00:00Z' },
      { id: 'd2', filename: 'b.pdf', exposureScore: 0, isOrphan: true, lastRetrievedAt: null },
    ])
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine.test/graph/topic/t1?workspace_id=ws1&user_id=u1&role=member&as_group=grp-5')
  })
})

describe('listFindings', () => {
  it('maps document_id -> documentId and omits kind when not passed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        findings: [
          { id: 'f1', kind: 'orphan', document_id: 'd1', severity: 0.8, detail: { reason: 'no_links' }, filename: 'x.pdf' },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await listFindings('ws1', 'u1', 'member', undefined, undefined)

    expect(result).toEqual([
      { id: 'f1', kind: 'orphan', documentId: 'd1', severity: 0.8, detail: { reason: 'no_links' }, filename: 'x.pdf' },
    ])
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine.test/graph/findings?workspace_id=ws1&user_id=u1&role=member')
    expect(url).not.toContain('kind=')
  })

  it('includes kind in the query string when passed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ findings: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await listFindings('ws1', 'u1', 'member', 'grp-2', 'stale')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'http://engine.test/graph/findings?workspace_id=ws1&user_id=u1&role=member&as_group=grp-2&kind=stale',
    )
  })
})

describe('rebuildGraph', () => {
  it('POSTs workspace_id and maps the returned job', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ job: { id: 'j2', status: 'running', error: null, computed_at: null } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const job = await rebuildGraph('ws1')

    expect(job).toEqual({ id: 'j2', status: 'running', error: null, computedAt: null })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine.test/graph/rebuild')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ workspace_id: 'ws1' })
  })

  it('returns null when the engine has no job yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ job: null })))
    const job = await rebuildGraph('ws1')
    expect(job).toBeNull()
  })
})

describe('dismissFinding', () => {
  it('returns true on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })))
    await expect(dismissFinding('ws1', 'f1')).resolves.toBe(true)
  })

  it('returns false on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    await expect(dismissFinding('ws1', 'missing')).resolves.toBe(false)
  })

  it('throws on other non-ok statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    await expect(dismissFinding('ws1', 'f1')).rejects.toThrow('500')
  })
})
