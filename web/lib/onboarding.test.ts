import { describe, expect, it } from 'vitest'
import { deriveOnboarding } from './onboarding'

const base = { indexedCount: 0, foldered: false, hasAsked: false, dismissed: false }

describe('deriveOnboarding', () => {
  it('marks nothing done for a brand-new workspace and flags it empty', () => {
    const s = deriveOnboarding(base)
    expect(s.steps.map((x) => x.done)).toEqual([false, false, false])
    expect(s.workspaceEmpty).toBe(true)
    expect(s.complete).toBe(false)
    expect(s.show).toBe(true)
  })

  it('completes step 1 once a document is indexed', () => {
    const s = deriveOnboarding({ ...base, indexedCount: 2 })
    expect(s.steps[0].done).toBe(true)
    expect(s.workspaceEmpty).toBe(false)
  })

  it('completes all three and stops showing', () => {
    const s = deriveOnboarding({ indexedCount: 3, foldered: true, hasAsked: true, dismissed: false })
    expect(s.complete).toBe(true)
    expect(s.show).toBe(false)
  })

  // Dismissal hides the strip. It must NOT fake completion, or a half-set-up
  // workspace would report itself as finished.
  it('hides when dismissed without claiming completion', () => {
    const s = deriveOnboarding({ ...base, indexedCount: 1, dismissed: true })
    expect(s.show).toBe(false)
    expect(s.complete).toBe(false)
  })

  it('a member joining a populated workspace is not asked to upload', () => {
    const s = deriveOnboarding({ indexedCount: 40, foldered: true, hasAsked: false, dismissed: false })
    expect(s.workspaceEmpty).toBe(false)
    expect(s.steps[0].done).toBe(true)
    expect(s.steps[1].done).toBe(true)
    expect(s.steps[2].done).toBe(false)
  })
})
