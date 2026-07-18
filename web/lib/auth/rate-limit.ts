import 'server-only'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const hits = new Map<string, number[]>()

export function checkLoginRate(key: string): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  if (recent.length > MAX_ATTEMPTS) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - recent[0]) }
  }
  return { ok: true, retryAfterMs: 0 }
}
