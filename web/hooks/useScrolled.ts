'use client'

import { useSyncExternalStore } from 'react'

/**
 * True once the page has scrolled past `threshold`.
 *
 * Scroll position is an external store, so it is read through
 * useSyncExternalStore rather than mirrored into state from an effect. That
 * also means the value is correct on the very first render when a page loads
 * already-scrolled (a restored scroll position, or a #hash landing).
 */

const THRESHOLD = 24

function subscribe(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  return () => window.removeEventListener('scroll', onChange)
}

const getSnapshot = () => window.scrollY > THRESHOLD
const getServerSnapshot = () => false

export function useScrolled() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
