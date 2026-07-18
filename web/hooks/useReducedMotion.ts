'use client'

import { useSyncExternalStore } from 'react'

/**
 * Tracks prefers-reduced-motion, including live changes — people toggle it while
 * a page is open, and the swarm must honor that immediately.
 *
 * useSyncExternalStore rather than useState+useEffect: a media query IS an
 * external store, and reading it via setState-in-an-effect causes a cascading
 * re-render on every mount (and trips react-hooks/set-state-in-effect).
 * getServerSnapshot returns false so SSR and first paint agree.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches
const getServerSnapshot = () => false

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
