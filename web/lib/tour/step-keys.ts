/**
 * Every tour step key ever minted, across every task that adds one — spec
 * §6: step keys are append-only, never renamed or reused. `POST
 * /api/tour/step` (route.ts) validates an incoming `stepKey` against this
 * list before writing it, so a client-side typo can never silently pollute
 * `user_tour_steps` with a key nothing will ever look for again.
 *
 * `citation-hint-v1` has no corresponding entry in `steps.ts` yet — the
 * citation coach mark is a later task (spec §4 "Deliberately not tour
 * steps") — but it is already a real, reserved key per this task's brief,
 * so it is listed here now and needs no further change to this file once
 * that task wires it up.
 *
 * Reworking what a step *means* mints a new key (`…-v2`) and retires this
 * one by leaving it in place, unused — never delete or rename an entry.
 */
export const KNOWN_TOUR_STEP_KEYS = [
  'welcome-v1',
  'upload-v1',
  'organise-v1',
  'access-v1',
  'access-member-v1',
  'ask-v1',
  'citation-hint-v1',
] as const

export type KnownTourStepKey = (typeof KNOWN_TOUR_STEP_KEYS)[number]

export function isKnownTourStepKey(value: unknown): value is KnownTourStepKey {
  return (
    typeof value === 'string' &&
    (KNOWN_TOUR_STEP_KEYS as readonly string[]).includes(value)
  )
}
