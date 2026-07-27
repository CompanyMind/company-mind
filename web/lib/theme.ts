/**
 * Appearance preferences.
 *
 * Deliberately NOT `import 'server-only'`: the root layout reads these on the
 * server and the Settings controls write them from the client, so both halves
 * need the same guards. Same reasoning as lib/i18n/index.ts.
 *
 * 'system' is stored as a real value rather than as null. The distinction
 * matters: "follow the OS" is a choice a user makes, and a null would be
 * indistinguishable from "never asked" — which is exactly what a future change
 * of default would need to tell apart.
 */
export type Theme = 'system' | 'light' | 'dark'
export type Motion = 'system' | 'reduced'

export const THEMES: readonly Theme[] = ['system', 'light', 'dark']
export const MOTIONS: readonly Motion[] = ['system', 'reduced']

export const THEME_COOKIE = 'cm_theme'
export const MOTION_COOKIE = 'cm_motion'

/**
 * One year. These are preferences, not credentials — losing one is a papercut,
 * not a security event, and a short TTL would make the theme flip on people
 * mid-week. The durable copy lives on `users`; this cookie exists only so the
 * server can render the right palette before the session is even resolved.
 */
export const PREF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isTheme(x: unknown): x is Theme {
  return typeof x === 'string' && (THEMES as readonly string[]).includes(x)
}

export function isMotion(x: unknown): x is Motion {
  return typeof x === 'string' && (MOTIONS as readonly string[]).includes(x)
}
