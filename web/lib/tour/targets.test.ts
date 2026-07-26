import { describe, expect, it } from 'vitest'
import { createTourTargetRegistry, type TourTarget } from './targets'

// `steps.ts` (the tour's step list) doesn't exist yet — it's a later task —
// so this guards the registry itself: registering makes an element
// retrievable, the callback-ref `null` call (unmount) removes it, and an
// unknown target name is a `tsc` error, not a silent no-op selector.
//
// The vitest environment here is plain `node` (no DOM), so there is nothing
// to render a real `<div>` against. The registry never calls a DOM method on
// what it's given — it only stores and returns the reference — so a plain
// object cast to `HTMLElement` exercises exactly the same code path a real
// node would.
function fakeEl(): HTMLElement {
  return {} as HTMLElement
}

describe('createTourTargetRegistry', () => {
  it('registering an element makes it retrievable', () => {
    const { targets, register } = createTourTargetRegistry()
    const el = fakeEl()
    register('ask-pane', el)
    expect(targets.get('ask-pane')).toBe(el)
  })

  it('the callback ref called with null (unmount) removes the entry', () => {
    const { targets, register } = createTourTargetRegistry()
    const el = fakeEl()
    register('ask-composer', el)
    expect(targets.has('ask-composer')).toBe(true)

    register('ask-composer', null)
    expect(targets.has('ask-composer')).toBe(false)
    expect(targets.get('ask-composer')).toBeUndefined()
  })

  it('unregistering a target that never registered is a safe no-op', () => {
    // Mirrors the Organise button, which only renders when unfiledCount > 0:
    // its ref callback may never fire with a real node at all.
    const { targets, register } = createTourTargetRegistry()
    expect(() => register('organise-button', null)).not.toThrow()
    expect(targets.has('organise-button')).toBe(false)
  })

  it('re-registering the same name overwrites rather than duplicates', () => {
    const { targets, register } = createTourTargetRegistry()
    const first = fakeEl()
    const second = fakeEl()
    register('rail-sources', first)
    register('rail-sources', second)
    expect(targets.size).toBe(1)
    expect(targets.get('rail-sources')).toBe(second)
  })

  it('each of the five targets registers and unregisters independently', () => {
    const { targets, register } = createTourTargetRegistry()
    const names: TourTarget[] = ['ask-pane', 'ask-composer', 'rail-sources', 'rail-access', 'organise-button']
    for (const name of names) register(name, fakeEl())
    expect(targets.size).toBe(5)

    register('rail-access', null)
    expect(targets.size).toBe(4)
    expect(targets.has('rail-access')).toBe(false)
    for (const name of names.filter((n) => n !== 'rail-access')) {
      expect(targets.has(name)).toBe(true)
    }
  })

  it('TourTarget has exactly these five members (compile-time exhaustiveness)', () => {
    // If a member is added to the union without adding it here, TS reports a
    // missing property; if one is removed, an excess property — the type
    // checker enforces the union's membership directly, not just this list.
    const exhaustive: Record<TourTarget, true> = {
      'ask-pane': true,
      'ask-composer': true,
      'rail-sources': true,
      'rail-access': true,
      'organise-button': true,
    }
    expect(Object.keys(exhaustive).sort()).toEqual(
      ['ask-composer', 'ask-pane', 'organise-button', 'rail-access', 'rail-sources'].sort(),
    )
  })

  it('an unknown target name is a compile-time error, not a silent no-op', () => {
    const { register } = createTourTargetRegistry()
    // @ts-expect-error 'renamed-or-typoed-target' is not a member of TourTarget — this line
    // must keep failing to typecheck; if it ever stops, `tsc` (and `npm run build`) fails.
    register('renamed-or-typoed-target', null)
  })
})
