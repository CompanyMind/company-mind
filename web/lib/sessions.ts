import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions } from '@/lib/db/schema'

export type SessionRow = {
  id: string
  device: string
  ip: string | null
  createdAt: Date
  current: boolean
}

/**
 * A readable device name from a user-agent string.
 *
 * Order matters twice over: Edge and Opera both put "Chrome/" in their UA, and
 * Chrome puts "Safari/" in its own — so the specific tests must run before the
 * general ones, or every browser on earth reports as Chrome, or as Safari.
 * Likewise an iPhone's UA contains "like Mac OS X", so iOS is checked first.
 *
 * No dependency, and deliberately no IP-geolocation lookup: this list renders
 * on an air-gapped on-prem install, and calling out to a geolocation service to
 * prettify a row would be a live contradiction of the product's central claim.
 */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Mac OS X|Macintosh/.test(ua)
        ? 'macOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  if (browser && os) return `${browser} on ${os}`
  return browser ?? os ?? 'Unknown device'
}

/** The caller's own sessions. Scoped to one user id — there is no argument
 *  here that could widen it to anyone else's. */
export async function listUserSessions(
  userId: string,
  currentSessionId: string,
): Promise<SessionRow[]> {
  const rows = await db.query.sessions.findMany({
    where: eq(sessions.userId, userId),
    orderBy: [desc(sessions.createdAt)],
  })
  return rows.map((r) => ({
    id: r.id,
    device: describeUserAgent(r.userAgent),
    ip: r.ip,
    createdAt: r.createdAt,
    current: r.id === currentSessionId,
  }))
}

/**
 * Sign out everywhere, INCLUDING the caller — which is exactly what the label
 * says. The route clears the session cookie afterwards so the caller is not
 * left holding a token whose row no longer exists.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id })
  return deleted.length
}
