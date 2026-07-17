/**
 * The CompBrain mark: a drawn perimeter with a small lattice inside it.
 *
 * This is the whole product in 20x20 — "your walls, and one organized brain
 * within them." It is the same idea the homepage canvas spends 8 scenes making
 * felt, which is why the site needs no other logo.
 *
 * Pure inline SVG: no asset request, no layout shift, inherits currentColor.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="flex items-center gap-2.5">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="shrink-0 overflow-visible"
        >
          {/* the walls */}
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            rx="3.5"
            stroke="currentColor"
            strokeWidth="1.25"
            opacity="0.35"
          />
          {/* the lattice within — three nodes, connected */}
          <path
            d="M6.5 13.5 L10 6.5 L13.5 13.5 M6.5 13.5 L13.5 13.5"
            stroke="var(--brain)"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="6.5" r="1.6" fill="var(--brain)" />
          <circle cx="6.5" cy="13.5" r="1.6" fill="var(--brain)" />
          <circle cx="13.5" cy="13.5" r="1.6" fill="var(--brain)" />
        </svg>
        <span className="font-display text-[1.0625rem] font-bold tracking-[-0.03em]">
          CompBrain
        </span>
      </span>
    </span>
  )
}
