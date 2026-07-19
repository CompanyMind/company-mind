/**
 * The CompanyMind mark: nested squares — the walls, and the indexed core
 * within them. Same shape as the favicon (web/app/icon.svg, viewBox 0 0 32
 * 32) at inline nav size, so the icon reads identically in the browser tab
 * and in the product itself.
 *
 * Kept as a duplicate of marketing/components/Wordmark.tsx rather than a
 * shared import: web/ and marketing/ are separate deployables on purpose
 * (see CLAUDE.md), so this file intentionally does not cross that boundary.
 * Keep the two in sync by hand if the mark ever changes.
 *
 * Pure inline SVG: no asset request, no layout shift, inherits currentColor.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2.5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className="shrink-0 overflow-visible"
        >
          <rect
            x="4.5"
            y="4.5"
            width="23"
            height="23"
            rx="6.6"
            stroke="currentColor"
            strokeWidth="2.2"
            opacity="0.35"
          />
          <rect x="10.2" y="10.2" width="11.6" height="11.6" rx="3.4" stroke="var(--brain)" strokeWidth="1.6" />
          <rect x="13.6" y="13.6" width="4.8" height="4.8" rx="1.5" fill="var(--brain)" />
        </svg>
        <span className="font-display text-[1.0625rem] font-bold tracking-[-0.03em]">
          CompanyMind
        </span>
      </span>
    </span>
  )
}
