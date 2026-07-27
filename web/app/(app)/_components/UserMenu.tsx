'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTour } from './tour/TourProvider'
import { getDictionary, isLocale, type Locale } from '@/lib/i18n'

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'uz', label: 'Oʻzbekcha' },
]

export function UserMenu({
  csrf,
  workspace,
  userName,
  userEmail,
  locale,
  deploymentMode,
  collapsed,
}: {
  csrf: string
  workspace: string
  userName: string | null
  userEmail: string
  locale: string
  /** Presentation only — see lib/env.ts. Decides what the egress line CLAIMS,
   *  never what anything allows. */
  deploymentMode: 'hosted' | 'onprem'
  collapsed: boolean
}) {
  const router = useRouter()
  const path = usePathname()
  const dict = getDictionary(isLocale(locale) ? locale : 'en')
  const [open, setOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  // The permanent replay entry point (guided-tour spec §5) — the only
  // affordance that serves a user onboarded outside the narrow auto-start
  // window (a deep link, a dismissal they regret, a step added long after they
  // joined). `fromBeginning: true`: Guide is a deliberate full walkthrough, not
  // a resume — it never clears user_tour_steps (the POST route is insert-only,
  // ON CONFLICT DO NOTHING), so replaying changes nothing about what a FUTURE
  // new step's set-difference check will see.
  const { start } = useTour()

  const close = useCallback(() => {
    setOpen(false)
    setLangOpen(false)
  }, [])

  // Close on route change — otherwise picking Settings leaves the menu hanging
  // open behind the modal.
  useEffect(() => close(), [path, close])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  // ⌘, / Ctrl+, — the shortcut every desktop app uses for preferences.
  //
  // Deliberately NOT skipped while a text field has focus. The usual "ignore
  // shortcuts while typing" guard exists to avoid swallowing a character, and
  // this combination cannot be one: a literal comma is typed without a
  // modifier. With the guard in place the shortcut was dead on the surface
  // people use most, because the empty state autofocuses the composer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === ',')) return
      e.preventDefault()
      router.push('/dashboard/settings/general')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [router])

  async function pickLanguage(code: Locale) {
    close()
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ locale: code }),
    })
    // Copy is resolved server-side per request from users.locale, so the new
    // language only appears once the server re-renders.
    router.refresh()
  }

  const initial = (userName || userEmail).trim().charAt(0).toUpperCase()

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-line bg-paper-raised p-1.5 shadow-lift"
        >
          <p className="truncate px-2.5 py-1.5 text-body-sm text-ink-soft" title={userEmail}>
            {userEmail}
          </p>
          <div className="my-1 h-px bg-line" />

          <Link
            href="/dashboard/settings/general"
            role="menuitem"
            className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-body-sm text-ink hover:bg-paper-sunk"
          >
            {dict.settings.title}
            <kbd className="font-mono text-[0.6875rem] text-ink-soft">⌘,</kbd>
          </Link>

          {/* Opens on hover and on focus, not on click — pointing at "Language"
              should show the languages, the way a desktop menu does. The click
              handler stays for touch and for anyone driving this from the
              keyboard, where there is no hover to give. */}
          <div
            onMouseEnter={() => setLangOpen(true)}
            onFocus={() => setLangOpen(true)}
            onMouseLeave={() => setLangOpen(false)}
          >
            <button
              type="button"
              role="menuitem"
              aria-expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-body-sm text-ink hover:bg-paper-sunk"
            >
              {dict.settings.general.language}
              <span className="text-ink-soft">{langOpen ? '▾' : '›'}</span>
            </button>
            {langOpen && (
              <div className="pb-1 pl-2.5">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={l.code === locale}
                    onClick={() => pickLanguage(l.code)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-body-sm text-ink-soft hover:bg-paper-sunk hover:text-ink"
                  >
                    <span className="w-3 text-brain-text">{l.code === locale ? '✓' : ''}</span>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              start({ fromBeginning: true })
            }}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-body-sm text-ink hover:bg-paper-sunk"
          >
            {dict.settings.general.replayTour}
          </button>

          <div className="my-1 h-px bg-line" />

          <div className="px-2.5 py-1.5">
            <div className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-soft">
              <span
                className="h-1.5 w-1.5 rounded-full bg-brain motion-safe:animate-heartbeat"
                aria-hidden="true"
              />
              egress 0 B
            </div>
            {/* The claim differs by mode and must stay true in both. On-prem the
                data never leaves the customer's own network. Hosted, many firms
                share one server, so "your infrastructure" is not available —
                "never leaves this server, never trains anything" is. */}
            <p className="mt-1 text-body-sm text-ink-soft">
              {deploymentMode === 'onprem'
                ? 'Nothing leaves your infrastructure.'
                : 'Nothing leaves this server. Never used for training.'}
            </p>
          </div>

          <div className="my-1 h-px bg-line" />

          <form action="/logout" method="post">
            <button
              role="menuitem"
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-body-sm text-ink hover:bg-paper-sunk"
            >
              {dict.settings.account.signOut}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? (userName ?? userEmail) : undefined}
        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-paper-raised"
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brain text-[0.8125rem] font-semibold text-paper-raised"
        >
          {initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm text-ink">{userName ?? userEmail}</span>
              <span className="block truncate text-[0.75rem] text-ink-soft">{workspace}</span>
            </span>
            <span aria-hidden="true" className="text-ink-soft">
              ⌄
            </span>
          </>
        )}
      </button>
    </div>
  )
}
