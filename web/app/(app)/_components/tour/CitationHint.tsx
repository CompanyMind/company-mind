'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'
import { useTour } from './TourProvider'

const CITATION_HINT_KEY = 'citation-hint-v1'

/**
 * The just-in-time citation coach mark — spec §4 "Deliberately not tour
 * steps": a citation button does not exist in the DOM until an answer with
 * a citation actually renders, so a fixed joyride step can never anchor to
 * one. Teaching it at the moment it happens is also simply better than
 * narrating it 90 seconds earlier at `ask-v1` (which shows a static
 * replica of this exact chip for that reason).
 *
 * Shown the first time ever (per user) an answer with >=1 citation renders,
 * anchored to `anchorEl` (AskChat.tsx passes the first citation chip button
 * of the first cited message it has rendered). Recorded as SHOWN — spec
 * §6's honest "seen" semantic, the same one every joyride step uses — the
 * instant it actually becomes visible, not gated behind the user dismissing
 * it: a user who never clicks or presses Escape and simply navigates away
 * must still never see it again, the same "never returns" guarantee the
 * brief asks for regardless of whether they engaged with it.
 *
 * Non-modal by design (global constraint, and spec §5's interaction rules
 * for the tour generally): no scrim, no focus trap, and — deliberately
 * different from TourCard.tsx — no stolen focus either. The user may be
 * mid-keystroke in the composer when a cited answer lands; grabbing focus
 * out from under them is exactly what "ignore it entirely and keep
 * working" rules out.
 */
export function CitationHint({
  anchorEl,
  dict,
}: {
  /** The first citation chip button of the first cited answer rendered so
   * far, or `null` until one exists. */
  anchorEl: HTMLButtonElement | null
  dict: Dictionary['tour']['citationHint']
}) {
  const { hasSeenStep, recordStepSeen } = useTour()
  const [dismissed, setDismissed] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Snapshotted ONCE at mount via a lazy initializer, not called fresh on
  // every render. `hasSeenStep` reads a ref that THIS component's own
  // "recorded" effect below mutates to `true` the instant it first becomes
  // visible; the position-tracking effect further down calls `setPos` on
  // every animation frame while visible, which re-renders this component
  // continuously. Calling `hasSeenStep()` inline in that re-render (as a
  // prior version of this file did) made the hint witness its own write one
  // frame after appearing and unmount itself — recorded correctly, but
  // visible for under 16ms, which is not "shown" by any real definition.
  // Freezing the check at mount sidesteps that entirely: mount always
  // happens with `anchorEl` still `null` (AskChat renders this unconditionally,
  // before any citation exists), so `alreadySeen` correctly reflects
  // whatever was true across previous sessions, never this instance's own
  // subsequent write.
  const [alreadySeen] = useState(() => hasSeenStep(CITATION_HINT_KEY))
  const visible = !!anchorEl && !dismissed && !alreadySeen

  const dismiss = useCallback(() => setDismissed(true), [])

  // Recorded the instant the hint is actually visible — see the module doc
  // above for why this isn't gated behind the dismiss action.
  useEffect(() => {
    if (visible) recordStepSeen(CITATION_HINT_KEY)
  }, [visible, recordStepSeen])

  // Escape dismisses from anywhere on the page, same as the tour itself
  // (spec §5, "Escape always ends the tour, from every step").
  useEffect(() => {
    if (!visible) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [visible, dismiss])

  // A click anywhere dismisses — including a click on the citation chip
  // itself, so taking the taught action also closes the hint. Bound on
  // `click` (bubble phase, after the chip's own onClick already ran), not
  // `mousedown`, so opening the source excerpt is never swallowed by this
  // handler running first.
  useEffect(() => {
    if (!visible) return
    document.addEventListener('click', dismiss)
    return () => document.removeEventListener('click', dismiss)
  }, [visible, dismiss])

  // Glued to `anchorEl`'s live position every animation frame while
  // visible — the same technique Atlas.tsx's own node tooltip uses to track
  // a target through scroll/pan without a scroll-event listener on every
  // possible scrolling ancestor. The chat pane scrolls independently of the
  // window, so a one-shot `getBoundingClientRect()` at mount would drift
  // stale the moment the user scrolls.
  useEffect(() => {
    if (!visible || !anchorEl) return
    let raf = 0
    const margin = 8
    const tick = () => {
      const anchorRect = anchorEl.getBoundingClientRect()
      const card = cardRef.current
      const cardWidth = card?.offsetWidth ?? 256
      const cardHeight = card?.offsetHeight ?? 0
      let top = anchorRect.bottom + margin
      if (top + cardHeight > window.innerHeight - margin) {
        top = Math.max(margin, anchorRect.top - cardHeight - margin)
      }
      let left = anchorRect.left
      if (left + cardWidth > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - cardWidth - margin)
      }
      setPos({ top, left })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, anchorEl])

  if (!visible || !pos) return null

  return (
    <div
      ref={cardRef}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-40 w-64 rounded-lg border border-line border-l-2 border-l-brain bg-paper-raised p-3 shadow-lift motion-safe:animate-fade-in"
    >
      <p className="font-display text-body-sm text-ink">{dict.heading}</p>
      <p className="mt-1 text-body-sm text-ink-soft">{dict.body}</p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        {dict.dismiss}
      </button>
    </div>
  )
}
