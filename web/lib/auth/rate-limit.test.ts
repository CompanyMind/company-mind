import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkLoginRate, resetLoginRateLimit, trackedKeyCount } from './rate-limit'

const WINDOW_MS = 15 * 60 * 1000

beforeEach(() => {
  resetLoginRateLimit()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  resetLoginRateLimit()
})

describe('checkLoginRate', () => {
  it('allows up to ten attempts in the window, then refuses', () => {
    for (let i = 0; i < 10; i++) expect(checkLoginRate('ip:a@b.c').ok).toBe(true)
    const blocked = checkLoginRate('ip:a@b.c')
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('forgives once the window has passed', () => {
    for (let i = 0; i < 11; i++) checkLoginRate('ip:a@b.c')
    expect(checkLoginRate('ip:a@b.c').ok).toBe(false)

    vi.advanceTimersByTime(WINDOW_MS + 1)
    expect(checkLoginRate('ip:a@b.c').ok).toBe(true)
  })

  it('counts each key independently', () => {
    for (let i = 0; i < 11; i++) checkLoginRate('ip:a@b.c')
    expect(checkLoginRate('ip:a@b.c').ok).toBe(false)
    expect(checkLoginRate('ip:other@b.c').ok).toBe(true)
  })
})

describe('the key map does not grow without bound', () => {
  it('evicts keys whose window has drained', () => {
    // An attacker rotating the email field: every attempt is a brand-new key.
    for (let i = 0; i < 500; i++) checkLoginRate(`1.2.3.4:victim${i}@example.test`)
    expect(trackedKeyCount()).toBe(500)

    // A window later, every one of them is dead weight.
    vi.advanceTimersByTime(WINDOW_MS + 1)
    checkLoginRate('1.2.3.4:someone-else@example.test')

    expect(trackedKeyCount()).toBe(1)
  })

  it('does not evict a key that is still inside its window', () => {
    checkLoginRate('ip:live@example.test')
    vi.advanceTimersByTime(WINDOW_MS - 1000)
    checkLoginRate('ip:other@example.test')
    expect(trackedKeyCount()).toBe(2)
  })
})
