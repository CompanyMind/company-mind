// Pure, no-import derive-from-facts helpers for the guided tour — the same
// philosophy web/lib/onboarding.ts already documents: there is no stored
// "current step" anywhere. What to show is always a set difference computed
// fresh from real facts, so resume works identically across reloads, route
// changes and devices for free, and cannot desync.
//
// No imports on purpose, so vitest can reach these directly with zero setup
// (see targets.ts's createTourTargetRegistry for the same reasoning).

/**
 * The first key in `defined` (the role/workspace-scoped step order) that is
 * not present in `seen`, or `null` once every defined key has been seen.
 *
 * Unknown keys in `seen` are ignored — spec §6's append-only discipline
 * means a step key is never renamed or reused, so a retired key can sit in
 * `user_tour_steps` forever (GitLab's `user_callouts` enum has permanent
 * gaps for exactly this reason). Ignoring anything in `seen` that `defined`
 * doesn't mention is what keeps a retired row from ever being able to break
 * resume for the keys that still matter.
 */
export function nextStepKey(defined: string[], seen: string[]): string | null {
  const seenSet = new Set(seen)
  for (const key of defined) {
    if (!seenSet.has(key)) return key
  }
  return null
}

export type AutoStartFacts = {
  /** Rows in user_tour_steps for this (user, workspace) — not step position, just count. */
  seenCount: number
  /** users.tour_dismissed_at is set. */
  dismissed: boolean
  /** The landing pathname, e.g. '/dashboard' or '/dashboard/sources'. */
  path: string
  /** Whether a document upload is currently in flight for this workspace. */
  uploadInFlight: boolean
}

/**
 * True only for a genuinely fresh user landing squarely on `/dashboard` with
 * nothing else going on. Any deep link (a path other than exactly
 * `/dashboard`), any prior progress, an explicit dismissal, or an upload
 * already in flight all degrade to the quiet "Take the tour" pill instead —
 * spec §5. This also guarantees a user is never auto-started again after a
 * deploy that adds a step: `seenCount` is only ever 0 for a user who has
 * never seen any step at all.
 */
export function shouldAutoStart(f: AutoStartFacts): boolean {
  return f.seenCount === 0 && !f.dismissed && f.path === '/dashboard' && !f.uploadInFlight
}
