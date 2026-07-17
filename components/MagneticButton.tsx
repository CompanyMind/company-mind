'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A button that leans toward the cursor and snaps back when it leaves.
 *
 * Uses direct style writes inside pointermove rather than React state — this
 * fires at pointer rate and must never trigger a re-render. Transform is
 * composited, so the lean costs nothing on the main thread.
 *
 * Disabled entirely under reduced motion, and on coarse pointers where there
 * is no cursor to be magnetic toward.
 */
export function MagneticButton({
  href,
  children,
  className,
  variant = 'ink',
  type,
  onClick,
  disabled,
}: {
  href?: string
  children: ReactNode
  className?: string
  variant?: 'ink' | 'sovereign' | 'quiet'
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
}) {
  const ref = useRef<HTMLElement>(null)

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    // 0.28 is the lean strength — enough to feel alive, not enough to feel loose.
    el.style.transform = `translate3d(${dx * 0.28}px, ${dy * 0.28}px, 0)`
  }

  const onLeave = () => {
    const el = ref.current
    if (el) el.style.transform = 'translate3d(0, 0, 0)'
  }

  const styles = cn(
    'relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5',
    'font-mono text-telemetry uppercase tracking-[0.1em]',
    'transition-[transform,box-shadow,background-color] duration-300 ease-paper',
    'will-change-transform hover:shadow-lift',
    variant === 'ink' && 'bg-ink text-paper',
    // --sovereign is RARE: the perimeter pulse and the final CTA. Nothing else.
    variant === 'sovereign' && 'bg-sovereign text-paper',
    variant === 'quiet' && 'border border-line bg-paper-raised text-ink hover:border-ink-soft',
    disabled && 'pointer-events-none opacity-50',
    className,
  )

  if (href) {
    return (
      <Link
        ref={ref as never}
        href={href}
        className={styles}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {children}
      </Link>
    )
  }

  return (
    <button
      ref={ref as never}
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className={styles}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </button>
  )
}
