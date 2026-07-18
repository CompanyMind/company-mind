'use client'

import { useEffect, useRef } from 'react'

export function SourceDoc({
  text,
  charStart,
  charEnd,
}: {
  text: string
  charStart: number
  charEnd: number
}) {
  const markRef = useRef<HTMLElement>(null)
  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const before = text.slice(0, charStart)
  const hit = text.slice(charStart, charEnd)
  const after = text.slice(charEnd)

  return (
    <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-paper-raised p-5 font-body text-body leading-[1.8] text-ink">
      {before}
      <mark
        ref={markRef}
        className="rounded-sm bg-[color-mix(in_srgb,var(--brain)_24%,transparent)] px-0.5 text-ink"
      >
        {hit}
      </mark>
      {after}
    </pre>
  )
}
