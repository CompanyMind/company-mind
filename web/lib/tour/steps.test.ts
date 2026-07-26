import { describe, expect, it } from 'vitest'
import { getDictionary } from '@/lib/i18n'
import { buildSteps } from './steps'
import type { TourTarget } from './targets'

const dict = getDictionary('en')
const csrf = 'test-csrf'

// Mirrors targets.test.ts's exhaustiveness list — the runtime membership
// check a `target: TourTarget` field alone can't give as a plain array,
// even though `tsc` already rejects an unknown literal at the definition
// site in steps.ts.
const KNOWN_TARGETS: readonly TourTarget[] = [
  'ask-pane',
  'ask-composer',
  'rail-sources',
  'rail-access',
  'organise-button',
]

describe('buildSteps', () => {
  it('an owner with unfiled documents gets 4 steps in this release', () => {
    const steps = buildSteps({ role: 'owner', dict, hasUnfiled: true, csrf })
    expect(steps.map((s) => s.key)).toEqual(['welcome-v1', 'upload-v1', 'access-v1', 'ask-v1'])
  })

  it('an owner with no unfiled documents also gets 4 steps this release (organise-v1 is a later task)', () => {
    const steps = buildSteps({ role: 'owner', dict, hasUnfiled: false, csrf })
    expect(steps).toHaveLength(4)
  })

  it('a member gets 3 steps', () => {
    const steps = buildSteps({ role: 'member', dict, hasUnfiled: false, csrf })
    expect(steps.map((s) => s.key)).toEqual(['welcome-v1', 'access-member-v1', 'ask-v1'])
  })

  it("a member's step list never contains upload-v1, regardless of hasUnfiled", () => {
    for (const hasUnfiled of [true, false]) {
      const steps = buildSteps({ role: 'member', dict, hasUnfiled, csrf })
      expect(steps.some((s) => s.key === 'upload-v1')).toBe(false)
    }
  })

  it('every step target is a member of the TourTarget union, for both roles', () => {
    for (const role of ['owner', 'member'] as const) {
      const steps = buildSteps({ role, dict, hasUnfiled: true, csrf })
      for (const step of steps) {
        expect(KNOWN_TARGETS, `${role}/${step.key} target "${step.target}"`).toContain(
          step.target,
        )
      }
    }
  })

  it('every step has non-empty content', () => {
    for (const role of ['owner', 'member'] as const) {
      const steps = buildSteps({ role, dict, hasUnfiled: true, csrf })
      for (const step of steps) {
        expect(step.content, `${role}/${step.key}`).toBeTruthy()
      }
    }
  })

  it('welcome-v1 is first for both roles, centered on the whole ask pane', () => {
    for (const role of ['owner', 'member'] as const) {
      const [first] = buildSteps({ role, dict, hasUnfiled: false, csrf })
      expect(first.key).toBe('welcome-v1')
      expect(first.target).toBe('ask-pane')
      expect(first.placement).toBe('center')
    }
  })

  it('ask-v1 is always last, anchored to the composer', () => {
    for (const role of ['owner', 'member'] as const) {
      const steps = buildSteps({ role, dict, hasUnfiled: false, csrf })
      const last = steps[steps.length - 1]
      expect(last.key).toBe('ask-v1')
      expect(last.target).toBe('ask-composer')
    }
  })

  it('upload-v1 anchors the Sources rail link, not anything on the Sources page', () => {
    const steps = buildSteps({ role: 'owner', dict, hasUnfiled: true, csrf })
    const upload = steps.find((s) => s.key === 'upload-v1')
    expect(upload?.target).toBe('rail-sources')
  })

  it('the two access steps anchor the same rail link with role-specific copy', () => {
    const ownerAccess = buildSteps({ role: 'owner', dict, hasUnfiled: false, csrf }).find(
      (s) => s.key === 'access-v1',
    )
    const memberAccess = buildSteps({ role: 'member', dict, hasUnfiled: false, csrf }).find(
      (s) => s.key === 'access-member-v1',
    )
    expect(ownerAccess?.target).toBe('rail-access')
    expect(memberAccess?.target).toBe('rail-access')
  })
})
