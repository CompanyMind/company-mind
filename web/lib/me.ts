import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { isLocale, type Locale } from '@/lib/i18n'
import { isMotion, isTheme, type Motion, type Theme } from '@/lib/theme'

export type CleanProfile = {
  name?: string | null
  locale?: Locale
  theme?: Theme
  motion?: Motion
}

const MAX_NAME = 80

/**
 * Validate a PATCH /api/me body into exactly the fields a user may change
 * about themselves. Returns null when anything is invalid — the route turns
 * that into a 400 rather than partially applying a bad patch.
 *
 * Fields are read BY NAME and never spread. That is the whole point: `users`
 * also holds is_super_admin, blocked_at, password_hash and
 * must_change_password, and a validator built on `{...body}` would hand every
 * one of them to an UPDATE for whatever the caller felt like sending.
 */
export function cleanProfilePatch(input: unknown): CleanProfile | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const body = input as Record<string, unknown>
  const out: CleanProfile = {}

  if ('name' in body) {
    const raw = body.name
    if (raw !== null && typeof raw !== 'string') return null
    const trimmed = (raw ?? '').trim()
    // Reject rather than truncate: silently storing something other than what
    // someone typed is worse than telling them it did not fit.
    if (trimmed.length > MAX_NAME) return null
    out.name = trimmed === '' ? null : trimmed
  }
  if ('locale' in body) {
    if (typeof body.locale !== 'string' || !isLocale(body.locale)) return null
    out.locale = body.locale
  }
  if ('theme' in body) {
    if (!isTheme(body.theme)) return null
    out.theme = body.theme
  }
  if ('motion' in body) {
    if (!isMotion(body.motion)) return null
    out.motion = body.motion
  }

  return Object.keys(out).length === 0 ? null : out
}

export async function updateProfile(userId: string, patch: CleanProfile): Promise<void> {
  await db.update(users).set(patch).where(eq(users.id, userId))
}
