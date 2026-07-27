'use client'

import { useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SECTIONS, type Section, type SettingsData } from './section-keys'
import { General } from './sections/General'
import { Account } from './sections/Account'
import { Workspace } from './sections/Workspace'
import { Data } from './sections/Data'

export function SettingsShell({
  section,
  asModal,
  data,
}: {
  section: Section
  /** Rendered over the app (client navigation) or as a standalone page (hard
   *  refresh, pasted link). Same components either way — only the chrome
   *  around them differs. */
  asModal: boolean
  data: SettingsData
}) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const dict = data.dict.settings

  // Escape returns you to whatever you were doing, which is the entire reason
  // Settings is a modal rather than a page.
  const close = useCallback(() => {
    if (asModal) router.back()
    else router.push('/dashboard')
  }, [asModal, router])

  useEffect(() => {
    if (!asModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [asModal, close])

  // Move focus into the dialog on open. Without this, a keyboard user's focus
  // stays on the trigger behind the scrim and Tab walks the page they cannot
  // see.
  useEffect(() => {
    if (asModal) panelRef.current?.focus()
  }, [asModal])

  // Workspace is owner-only. Its rows link to People/Access/Integrations, each
  // of which notFound()s for a member, so offering the entry would be a dead
  // end — the same reasoning the sidebar's nav uses.
  const visible = SECTIONS.filter((s) => s !== 'workspace' || data.isOwner)
  const active = section === 'workspace' && !data.isOwner ? 'general' : section

  const body = (
    <div className="flex min-h-0 flex-1 max-md:flex-col">
      <nav className="w-48 shrink-0 border-r border-line p-3 max-md:w-full max-md:border-b max-md:border-r-0">
        <p className="px-2.5 pb-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-soft">
          {dict.title}
        </p>
        <div className="flex flex-col gap-0.5 max-md:flex-row max-md:flex-wrap">
          {visible.map((s) => (
            <Link
              key={s}
              href={`/dashboard/settings/${s}`}
              data-active={s === active}
              className="nav-link text-body-sm"
              scroll={false}
            >
              {dict.sections[s]}
            </Link>
          ))}
        </div>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {active === 'general' && (
          <General
            csrf={data.csrf}
            dict={dict}
            name={data.name}
            email={data.email}
            locale={data.locale}
            theme={data.theme}
            motion={data.motion}
            onClose={close}
          />
        )}
        {active === 'account' && <Account csrf={data.csrf} dict={dict} />}
        {active === 'workspace' && data.isOwner && (
          <Workspace
            csrf={data.csrf}
            dict={dict}
            name={data.workspaceName}
            deploymentMode={data.deploymentMode}
          />
        )}
        {active === 'data' && <Data csrf={data.csrf} dict={dict} onClose={close} />}
      </div>
    </div>
  )

  if (!asModal) {
    return (
      <div className="mx-auto flex h-dvh max-w-4xl flex-col px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">{dict.title}</h1>
          <Link href="/dashboard" className="text-body-sm text-ink-soft hover:text-ink">
            {dict.close}
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-paper-raised">
          {body}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        onClick={close}
        aria-hidden="true"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={dict.title}
        tabIndex={-1}
        className="relative flex h-[min(44rem,90dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-paper-raised shadow-lift outline-none"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg text-ink">{dict.title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={dict.close}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-sunk hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        {body}
      </div>
    </div>
  )
}
