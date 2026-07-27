import type { Dictionary, Locale } from '@/lib/i18n'
import type { Motion, Theme } from '@/lib/theme'

/**
 * The section keys and the data shape, in a plain module.
 *
 * Deliberately NOT in SettingsShell.tsx: that file is 'use client', and both
 * server entry points need `isSection` to validate the route param before they
 * render anything. Importing a function out of a client module and calling it
 * on the server is a runtime error, not a type error — which is exactly how
 * this was found. Same reasoning as lib/tour/step-keys.ts.
 */
export const SECTIONS = ['general', 'account', 'workspace', 'data'] as const
export type Section = (typeof SECTIONS)[number]

export function isSection(x: string): x is Section {
  return (SECTIONS as readonly string[]).includes(x)
}

export type SettingsData = {
  csrf: string
  dict: Dictionary
  name: string | null
  email: string
  locale: Locale
  theme: Theme
  motion: Motion
  workspaceName: string
  isOwner: boolean
  deploymentMode: 'hosted' | 'onprem'
}
