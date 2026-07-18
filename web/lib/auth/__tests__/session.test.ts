import { describe, it, expect } from 'vitest'
import { generateToken, hashToken, SESSION_TTL_MS, SESSION_COOKIE } from '../session'

describe('session tokens', () => {
  it('generates unguessable tokens and a stable hex hash', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toEqual(b)
    expect(a.length).toBeGreaterThanOrEqual(32)
    const h = hashToken(a)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(a)).toEqual(h) // deterministic
    expect(h).not.toContain(a) // never store the raw token
  })
  it('has a positive TTL and a cookie name', () => {
    expect(SESSION_TTL_MS).toBeGreaterThan(0)
    expect(SESSION_COOKIE).toBeTruthy()
  })
})
