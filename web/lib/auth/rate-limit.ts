import 'server-only'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

/**
 * In-process login throttle.
 *
 * Attempt timestamps were pruned WITHIN a key on every check, but the key
 * itself lived forever — so `hits` grew by one entry per distinct `ip:email`
 * ever seen and never shrank. Ordinary traffic leaks it slowly; an attacker
 * rotating the email field leaks it as fast as they can send requests, which is
 * a denial of service against the process rather than against any account.
 *
 * Two evictions fix it: a key whose window has fully drained is deleted rather
 * than stored as an empty array, and a periodic sweep clears keys that simply
 * stopped being touched (the common case — nobody "checks out" of a rate
 * limiter). The sweep is amortised over calls rather than run on a timer,
 * because a timer would hold the event loop open and this is a request-driven
 * structure.
 */
const hits = new Map<string, number[]>()

/** Sweep at most this often: cheap enough to be invisible, frequent enough that
 *  a burst cannot outrun it by more than a window's worth of keys. */
const SWEEP_INTERVAL_MS = 60 * 1000
let lastSweep = 0

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, times] of hits) {
    // The newest attempt decides: if even that one has aged out, the key has
    // nothing left to say.
    if (times.length === 0 || now - times[times.length - 1] >= WINDOW_MS) hits.delete(key)
  }
}

export function checkLoginRate(key: string): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  sweep(now)

  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)

  if (recent.length > MAX_ATTEMPTS) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - recent[0]) }
  }
  return { ok: true, retryAfterMs: 0 }
}

/** How many keys are currently retained. Exists for the test that holds the
 *  eviction invariant; nothing in the app reads it. */
export function trackedKeyCount(): number {
  return hits.size
}

/** Test seam only: drops all state. */
export function resetLoginRateLimit(): void {
  hits.clear()
  lastSweep = 0
}
