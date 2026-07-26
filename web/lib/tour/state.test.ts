import { describe, expect, it } from 'vitest'
import { nextStepKey, shouldAutoStart } from './state'

describe('nextStepKey', () => {
  it('returns the first defined key not yet in seen', () => {
    const defined = ['welcome-v1', 'upload-v1', 'access-v1', 'ask-v1']
    expect(nextStepKey(defined, ['welcome-v1'])).toBe('upload-v1')
  })

  it('returns the first defined key at all when seen is empty', () => {
    const defined = ['welcome-v1', 'upload-v1', 'access-v1', 'ask-v1']
    expect(nextStepKey(defined, [])).toBe('welcome-v1')
  })

  it('returns null once every defined key has been seen', () => {
    const defined = ['welcome-v1', 'upload-v1', 'access-v1', 'ask-v1']
    expect(nextStepKey(defined, defined)).toBeNull()
    expect(
      nextStepKey(defined, ['ask-v1', 'welcome-v1', 'upload-v1', 'access-v1']),
    ).toBeNull()
  })

  it('ignores unknown keys in seen — a retired step key must not break resume', () => {
    const defined = ['welcome-v1', 'upload-v1', 'access-v1', 'ask-v1']
    // 'old-welcome-v0' is a retired key still sitting in the table from
    // before it was renamed. It must never be mistaken for a defined key
    // that's been seen, nor block resume from finding the real first gap.
    expect(nextStepKey(defined, ['old-welcome-v0'])).toBe('welcome-v1')
  })

  it('returns null when defined is empty, regardless of seen', () => {
    expect(nextStepKey([], [])).toBeNull()
    expect(nextStepKey([], ['welcome-v1'])).toBeNull()
  })
})

describe('shouldAutoStart', () => {
  const base = { seenCount: 0, dismissed: false, path: '/dashboard', uploadInFlight: false }

  it('true when there are no seen rows, not dismissed, on /dashboard, and no upload in flight', () => {
    expect(shouldAutoStart(base)).toBe(true)
  })

  it('false when there is already at least one seen row', () => {
    expect(shouldAutoStart({ ...base, seenCount: 1 })).toBe(false)
  })

  it('false when the user has dismissed the tour', () => {
    expect(shouldAutoStart({ ...base, dismissed: true })).toBe(false)
  })

  it('false when the landing path is not exactly /dashboard (a deep link)', () => {
    expect(shouldAutoStart({ ...base, path: '/dashboard/sources' })).toBe(false)
    expect(shouldAutoStart({ ...base, path: '/dashboard/sources?doc=1' })).toBe(false)
  })

  it('false when an upload is in flight', () => {
    expect(shouldAutoStart({ ...base, uploadInFlight: true })).toBe(false)
  })

  it('false when every condition fails at once', () => {
    expect(
      shouldAutoStart({
        seenCount: 3,
        dismissed: true,
        path: '/dashboard/access',
        uploadInFlight: true,
      }),
    ).toBe(false)
  })
})
