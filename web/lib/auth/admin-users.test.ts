import { describe, expect, it } from 'vitest'
import { wouldBlockSelf } from './admin-users'

describe('wouldBlockSelf', () => {
  // Blocking yourself is a one-way door out of the only panel that can
  // unblock you. It must be refused before any write happens.
  it('refuses when actor and target are the same user', () => {
    expect(wouldBlockSelf('u1', 'u1')).toBe(true)
  })

  it('allows blocking a different user', () => {
    expect(wouldBlockSelf('u1', 'u2')).toBe(false)
  })
})
