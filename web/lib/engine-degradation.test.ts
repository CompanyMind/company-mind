import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTitle, getSuggestions } from './engine'

/**
 * Both of these are decoration, and both document a fallback. `generateTitle`
 * implemented it; `getSuggestions` implemented only half — it handled a non-2xx
 * response but not a rejected fetch, so an engine that was DOWN (rather than
 * merely unhappy) turned the Ask page's starter chips into an unhandled 500.
 *
 * "Network failure" is the case that actually happens, because that is what a
 * restarting or unreachable engine looks like from web.
 */
const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.ENGINE_BASE_URL = 'http://engine.test'
  process.env.ENGINE_INTERNAL_SECRET = 'secret-123'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

const refused = () => Promise.reject(new TypeError('fetch failed: ECONNREFUSED'))

describe('getSuggestions degrades instead of throwing', () => {
  it('returns [] when the engine is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(refused))
    await expect(getSuggestions('ws1', 'u1', 'member')).resolves.toEqual([])
  })

  it('returns [] on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response),
    )
    await expect(getSuggestions('ws1', 'u1', 'member')).resolves.toEqual([])
  })

  it('returns [] when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      } as unknown as Response),
    )
    await expect(getSuggestions('ws1', 'u1', 'member')).resolves.toEqual([])
  })

  it('still returns real questions when the engine answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({ questions: ['a?'] }) } as Response),
    )
    await expect(getSuggestions('ws1', 'u1', 'member')).resolves.toEqual(['a?'])
  })
})

describe('generateTitle degrades to a truncated question', () => {
  it('falls back when the engine is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(refused))
    await expect(generateTitle('What is the parental leave policy?')).resolves.toBe(
      'What is the parental leave policy?',
    )
  })
})
