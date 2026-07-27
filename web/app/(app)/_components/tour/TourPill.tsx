'use client'

/**
 * The quiet fallback shown whenever `shouldAutoStart` (web/lib/tour/state.ts)
 * says no — a deep link, a returning user with progress, or an upload
 * already in flight (spec §5). A small, dismissible affordance in the
 * product's own visual language (the same `paper-raised`/`shadow-lift`
 * chrome TourCard.tsx uses), never a banner or anything that competes with
 * the dashboard underneath.
 *
 * `onDismiss` sets `users.tour_dismissed_at` (via TourProvider.tsx) —
 * closing this pill is a real, permanent decline, same as declining at
 * welcome-v1 would be. The rail's permanent Guide item remains the way back
 * in regardless.
 */
export function TourPill({
  label,
  dismissLabel,
  onStart,
  onDismiss,
}: {
  label: string
  dismissLabel: string
  onStart: () => void
  onDismiss: () => void
}) {
  return (
    /* Never bottom-right.
     *
     * The composer is anchored to the bottom of the viewport and grows to fill
     * the width on a narrow screen, so the entire bottom band is the primary
     * control: measured at 420px, this pill sat directly on top of the send
     * button, and at 1200px it covered the "Nothing leaves this server" line.
     * There is no viewport corner that is safe at every width — so it docks
     * into the two regions that are structurally empty instead. On desktop
     * that is the sidebar column above the account menu; on mobile the sidebar
     * is a drawer, so it takes the free right end of the top bar. */
    <div className="fixed right-3 top-2.5 z-40 flex items-center gap-1 rounded-full border border-line bg-paper-raised py-1 pl-4 pr-1 shadow-lift md:bottom-20 md:left-4 md:right-auto md:top-auto">
      <button
        type="button"
        onClick={onStart}
        className="flex items-center gap-2 text-body-sm text-ink"
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-brain motion-safe:animate-heartbeat"
          aria-hidden="true"
        />
        {label}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="rounded-full px-2 py-1 text-body-sm text-ink-soft hover:text-ink"
      >
        ×
      </button>
    </div>
  )
}
