'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary, Locale } from '@/lib/i18n'
import type { Motion, Theme } from '@/lib/theme'
import { useTour } from '@/app/(app)/_components/tour/TourProvider'
import { SettingsRow, SettingsSection, Segmented, inputClass } from '../SettingsRow'

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'uz', label: 'Oʻzbekcha' },
]

export function General({
  csrf,
  dict,
  name,
  email,
  locale,
  theme,
  motion,
  onClose,
}: {
  csrf: string
  dict: Dictionary['settings']
  name: string | null
  email: string
  locale: Locale
  theme: Theme
  motion: Motion
  onClose: () => void
}) {
  const router = useRouter()
  const { start } = useTour()
  const [nameValue, setNameValue] = useState(name ?? '')
  const [localeValue, setLocaleValue] = useState(locale)
  const [themeValue, setThemeValue] = useState(theme)
  const [motionValue, setMotionValue] = useState(motion)
  const [error, setError] = useState<string | null>(null)

  async function save(patch: Record<string, unknown>): Promise<boolean> {
    setError(null)
    const r = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(patch),
    })
    if (!r.ok) {
      setError(dict.saveFailed)
      return false
    }
    return true
  }

  async function pickTheme(next: Theme) {
    const previous = themeValue
    setThemeValue(next)
    // Applied to the live document immediately rather than waiting for the
    // round trip: tokens.css keys `color-scheme` off this attribute, so the
    // whole app repaints the moment it changes. The PATCH is what makes it
    // survive a reload (users.theme) and a fresh server render (the cookie).
    document.documentElement.dataset.theme = next
    if (!(await save({ theme: next }))) {
      // A control still showing a state the server rejected is lying.
      setThemeValue(previous)
      document.documentElement.dataset.theme = previous
    }
  }

  async function pickMotion(next: Motion) {
    const previous = motionValue
    setMotionValue(next)
    document.documentElement.dataset.motion = next
    if (!(await save({ motion: next }))) {
      setMotionValue(previous)
      document.documentElement.dataset.motion = previous
    }
  }

  async function pickLocale(next: Locale) {
    const previous = localeValue
    setLocaleValue(next)
    if (await save({ locale: next })) {
      // Copy is resolved server-side per request from users.locale, so the new
      // language only appears once the server re-renders.
      router.refresh()
    } else {
      setLocaleValue(previous)
    }
  }

  async function commitName() {
    const clean = nameValue.trim()
    if (clean === (name ?? '')) return
    if (await save({ name: clean })) router.refresh()
    else setNameValue(name ?? '')
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 text-body-sm text-sovereign-text">
          {error}
        </p>
      )}

      <SettingsSection heading={dict.general.profile}>
        <SettingsRow label={dict.general.name} htmlFor="settings-name">
          <input
            id="settings-name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            maxLength={80}
            className={`${inputClass} md:w-64`}
          />
        </SettingsRow>
        <SettingsRow label={dict.general.email} description={dict.general.emailNote}>
          <span className="text-body-sm text-ink-soft">{email}</span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection heading={dict.general.preferences}>
        <SettingsRow
          label={dict.general.language}
          description={dict.general.languageNote}
          htmlFor="settings-locale"
        >
          <select
            id="settings-locale"
            value={localeValue}
            onChange={(e) => pickLocale(e.target.value as Locale)}
            className={`${inputClass} md:w-48`}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </SettingsRow>

        <SettingsRow label={dict.general.appearance}>
          <Segmented
            ariaLabel={dict.general.appearance}
            value={themeValue}
            onChange={pickTheme}
            options={[
              { value: 'system', label: dict.general.system },
              { value: 'light', label: dict.general.light },
              { value: 'dark', label: dict.general.dark },
            ]}
          />
        </SettingsRow>

        <SettingsRow label={dict.general.motion} description={dict.general.motionNote}>
          <Segmented
            ariaLabel={dict.general.motion}
            value={motionValue}
            onChange={pickMotion}
            options={[
              { value: 'system', label: dict.general.system },
              { value: 'reduced', label: dict.general.reduced },
            ]}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection heading={dict.general.help}>
        <SettingsRow label={dict.general.replayTour} description={dict.general.replayTourNote}>
          <button
            type="button"
            onClick={() => {
              // Close first — the tour points at chrome behind this modal.
              onClose()
              start({ fromBeginning: true })
            }}
            className="rounded-lg border border-line-control px-3 py-1.5 text-body-sm text-ink hover:bg-paper-sunk"
          >
            {dict.general.replayTourCta}
          </button>
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
