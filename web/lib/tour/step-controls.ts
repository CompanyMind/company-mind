import { createContext, useContext } from 'react'

/**
 * How a step's own `content` can reach the shared footer `TourCard` renders
 * around it. `TourStep.content` (steps.ts) is an opaque `ReactNode` with no
 * props channel of its own back to the card shell — yet spec §5 requires
 * the upload step to (a) keep the shared "Next" button disabled until the
 * server has accepted at least one file, never on indexing completion, and
 * (b) offer its own "Skip this" escape hatch that advances regardless, for
 * someone with no files to hand right now. See
 * docs/superpowers/specs/2026-07-26-guided-tour-design.md §4 step 2 and §5
 * ("Steps 2 and 3 also advance on the real action").
 *
 * Deliberately generic, not upload-specific: `TourCard.tsx` provides this
 * context around every step's content, so any future step needing the same
 * "gate Next on a real action" behaviour can reuse it without `TourCard`
 * having to know what kind of step it is.
 *
 * Default is a harmless no-op, the same pattern as `targets.ts`'s
 * `noopRegistry` and `TourProvider`'s `noopTour`: content that never calls
 * these (every step except upload-v1, today) behaves exactly as if this
 * context didn't exist — Next stays enabled, its own default state in
 * `TourCard`.
 */
export type TourStepControls = {
  /** Advance past this step immediately, bypassing `setNextEnabled`'s gate. */
  advance: () => void
  /** Gate the shared footer's Next button. Steps that never call this leave it enabled. */
  setNextEnabled: (enabled: boolean) => void
}

const noopControls: TourStepControls = {
  advance: () => {},
  setNextEnabled: () => {},
}

export const TourStepControlsContext = createContext<TourStepControls>(noopControls)

export function useTourStepControls(): TourStepControls {
  return useContext(TourStepControlsContext)
}
