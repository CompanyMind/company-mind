'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { TooltipRenderProps } from 'react-joyride'
import type { Dictionary } from '@/lib/i18n'
import { TourStepControlsContext, type TourStepControls } from '@/lib/tour/step-controls'

export type TourCardProps = TooltipRenderProps & {
  ui: Dictionary['tour']['ui']
}

/**
 * The tour's custom `tooltipComponent` — joyride renders this instead of its
 * own card entirely. See
 * docs/superpowers/specs/2026-07-26-guided-tour-design.md §3 and §7:
 *
 * - `role="dialog"`, never joyride's own `tooltipProps` (`role="alertdialog"`
 *   + `aria-modal="true"`). `aria-modal` confines a screen reader's virtual
 *   cursor to this card, hiding the exact dashboard element the step points
 *   at — the opposite of what a coach mark is for. `tooltipProps` is
 *   therefore never spread here; only the individual *Props objects
 *   (back/primary/skip) are used, and only their `onClick`, cherry-picked
 *   rather than spread, so this component owns every aria attribute itself.
 * - No focus trap (joyride's default one is disabled at the provider via
 *   `disableFocusTrap: true` — a later step hosts a real file input, which a
 *   trap would fight) and no `aria-live`.
 * - `tabIndex={-1}` on the container, with focus moved to it below. Joyride
 *   keys the floater wrapper by step index (`JoyrideStep-${index}` in its
 *   own Step.tsx), so this component fully remounts on every step change —
 *   a mount-time focus move already IS a per-step focus move.
 * - Fluid `max-width` (`min(92vw, 28rem)`), never a fixed 380px — that
 *   breaks the 320 CSS px reflow target at 400% zoom, and Russian runs
 *   15–30% longer than English on exactly these short strings.
 * - The primary "Next" button is gated through `TourStepControlsContext`
 *   (web/lib/tour/step-controls.ts), provided around `step.content` below.
 *   `TourStep.content` (steps.ts) is an opaque `ReactNode` with no props
 *   channel of its own back to this shell, yet the upload step must keep
 *   Next disabled until the server has accepted a file — never on indexing
 *   completion (spec §4 step 2, §5). Every other step never calls
 *   `setNextEnabled`, so Next simply stays enabled, its default state here.
 */
export function TourCard({
  backProps,
  controls,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  ui,
}: TourCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const bodyId = useId()

  // Defaults to enabled — most steps are plain prose with nothing to gate
  // on. Not reset by an effect: this component fully remounts per step (see
  // the module doc above), so a fresh `true` here on every step change is
  // already correct without extra plumbing.
  const [nextEnabled, setNextEnabled] = useState(true)
  const stepControls = useMemo<TourStepControls>(
    () => ({ advance: () => controls.next(), setNextEnabled }),
    [controls],
  )

  // Reacts to a step that has already changed (via remount, see the module
  // doc above) — this does not drive `stepIndex`, it only moves DOM focus in
  // response to it having changed.
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true })
  }, [])

  const caption = ui.stepOf
    .replace('{current}', String(index + 1))
    .replace('{total}', String(size))

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      tabIndex={-1}
      className="w-[min(92vw,28rem)] rounded-lg border border-line border-l-2 border-l-brain bg-paper-raised p-5 shadow-lift"
    >
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
        {caption}
      </p>
      <h2 id={headingId} className="mt-2 font-display text-lg text-ink">
        {step.title}
      </h2>
      <div id={bodyId} className="mt-2 text-body text-ink-soft">
        <TourStepControlsContext.Provider value={stepControls}>
          {step.content}
        </TourStepControlsContext.Provider>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!isLastStep && (
          <button
            type="button"
            data-tour-action="skip"
            onClick={skipProps.onClick}
            className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            {ui.skip}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {index > 0 && (
            <button
              type="button"
              data-tour-action="back"
              onClick={backProps.onClick}
              className="rounded-md border border-line px-4 py-2 text-body-sm text-ink hover:border-brain"
            >
              {ui.back}
            </button>
          )}
          <button
            type="button"
            data-tour-action="primary"
            onClick={primaryProps.onClick}
            disabled={!nextEnabled}
            className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLastStep ? ui.done : ui.next}
          </button>
        </div>
      </div>
    </div>
  )
}
