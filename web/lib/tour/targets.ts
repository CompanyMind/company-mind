'use client'

import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Every DOM element the guided tour (a later task) can point at. A step's
 * `target` must be a member of this union — rename or remove an entry here
 * and every call site that still names it becomes a `tsc` error at
 * `npm run build`, instead of a CSS selector that silently stops matching
 * in production and a tour step that just never appears.
 */
export type TourTarget = 'ask-pane' | 'ask-composer' | 'rail-sources' | 'rail-access' | 'organise-button'

export type TourTargetMap = Map<TourTarget, HTMLElement>

/**
 * The registry's actual state and mutation logic, with zero React
 * dependency. Kept separate so it is directly unit-testable: this project's
 * vitest environment is plain `node` (no DOM), so there is nothing a
 * React-rendering test could mount against here. `targets.test.ts` exercises
 * this function directly, registering plain objects cast to `HTMLElement` —
 * safe because the registry never calls a DOM method on what it's given, it
 * only stores and returns the reference.
 */
export function createTourTargetRegistry() {
  const targets: TourTargetMap = new Map()
  function register(name: TourTarget, el: HTMLElement | null): void {
    if (el) {
      targets.set(name, el)
    } else {
      targets.delete(name)
    }
  }
  return { targets, register }
}

type TourTargetContextValue = {
  targets: TourTargetMap
  register: (name: TourTarget, el: HTMLElement | null) => void
}

// The five attachment points call `useTourTarget` unconditionally on every
// authenticated page load, but `TourTargetProvider` is mounted only once the
// tour shell (a later task) needs it in the tree. Until then this default
// keeps registration a harmless no-op instead of throwing — those
// components render on every dashboard route regardless of whether the tour
// feature is wired up yet.
const noopRegistry: TourTargetContextValue = {
  targets: new Map(),
  register: () => {},
}

const TourTargetContext = createContext<TourTargetContextValue>(noopRegistry)

/**
 * Mounted once, above everything the tour can point at (the app layout).
 * Holds the live `TourTarget -> HTMLElement` map for the whole subtree.
 *
 * The map is mutated in place — its own identity never changes — so a
 * `version` counter is what makes context consumers re-render when a target
 * registers or unregisters. Without it, `useTourTargetEl` would keep
 * reading the same context value object and never notice a change.
 */
export function TourTargetProvider({ children }: { children: ReactNode }) {
  // A lazy `useState` initializer, not `useRef`: the registry is only ever
  // read during render (via `registry.targets` below), and reading a ref's
  // `.current` during render — even through this same lazy-init-once idiom —
  // is exactly what `eslint-plugin-react-hooks`'s `refs` rule now flags, since
  // it isn't safe under the React Compiler. The setter is never called, so
  // this object's identity is exactly as stable across re-renders as a ref's
  // would have been.
  const [registry] = useState(() => createTourTargetRegistry())
  const [version, setVersion] = useState(0)

  const register = useCallback(
    (name: TourTarget, el: HTMLElement | null) => {
      registry.register(name, el)
      setVersion((v) => v + 1)
    },
    [registry],
  )

  // `version` is included only so its identity change forces this memo (and
  // therefore every context consumer) to recompute — it is otherwise unread.
  const value = useMemo(
    () => ({ targets: registry.targets, register, version }),
    [registry, register, version],
  )

  return createElement(TourTargetContext.Provider, { value }, children)
}

/**
 * Returns a callback ref for `name`. React invokes a callback ref with the
 * node on mount (and again if the ref's own identity changes) and with
 * `null` right before unmount — that `null` call is what deletes the entry,
 * which is what makes a conditionally-rendered target (the Organise button
 * only exists when `unfiledCount > 0`) safe to register: it is simply
 * absent from the map whenever it isn't on screen, never a stale reference
 * to a removed node.
 *
 * Memoised with `useCallback` keyed on `name` and the context's `register`
 * (stable for the provider's lifetime) so the returned function keeps the
 * same identity across re-renders — an unstable identity would make React
 * detach and reattach the ref, hence delete-then-reinsert the entry, on
 * every single render.
 */
export function useTourTarget(name: TourTarget): (el: HTMLElement | null) => void {
  const { register } = useContext(TourTargetContext)
  return useCallback((el: HTMLElement | null) => register(name, el), [register, name])
}

/**
 * Read-only lookup for the tour shell (a later task): the live element for
 * `name`, or `null` if it hasn't registered (not yet mounted, or a target
 * like `organise-button` that only exists conditionally). Re-renders when
 * any target registers or unregisters.
 */
export function useTourTargetEl(name: TourTarget): HTMLElement | null {
  const { targets } = useContext(TourTargetContext)
  return targets.get(name) ?? null
}
