'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'
import { SettingsRow, SettingsSection, inputClass } from '../SettingsRow'
import { changeMyPassword } from '../actions'

type SessionRow = {
  id: string
  device: string
  ip: string | null
  createdAt: string
  current: boolean
}

export function Account({ csrf, dict }: { csrf: string; dict: Dictionary['settings'] }) {
  const [state, action, pending] = useActionState(changeMyPassword, undefined)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/me/sessions')
    if (r.ok) setSessions((await r.json()).sessions ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Changing a password kills every other session, so the list is stale the
  // moment it succeeds.
  useEffect(() => {
    if (state?.ok) load()
  }, [state?.ok, load])

  async function signOutEverywhere() {
    if (!window.confirm(`${dict.account.signOutAll}\n\n${dict.account.signOutAllNote}`)) return
    await fetch('/api/me/sessions', { method: 'DELETE', headers: { 'x-csrf-token': csrf } })
    // Every session is gone, including this one — a full navigation, not a
    // client-side route change, so nothing keeps rendering against a session
    // that no longer exists.
    window.location.href = '/login'
  }

  return (
    <>
      <SettingsSection heading={dict.account.password}>
        <form action={action} className="grid gap-3 py-4 md:max-w-sm">
          <label className="block">
            <span className="text-body-sm text-ink-soft">{dict.account.currentPassword}</span>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block">
            <span className="text-body-sm text-ink-soft">{dict.account.newPassword}</span>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              aria-describedby="settings-pw-hint"
              className={`mt-1 ${inputClass}`}
            />
            <span id="settings-pw-hint" className="mt-1 block text-body-sm text-ink-soft">
              {dict.account.passwordHint}
            </span>
          </label>
          <label className="block">
            <span className="text-body-sm text-ink-soft">{dict.account.confirmPassword}</span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className={`mt-1 ${inputClass}`}
            />
          </label>

          {state?.error && (
            <p role="alert" className="text-body-sm text-sovereign-text">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p role="status" className="text-body-sm text-brain-text">
              {dict.account.passwordChanged}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="justify-self-start rounded-lg bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-60"
          >
            {dict.account.changePassword}
          </button>
        </form>
      </SettingsSection>

      <SettingsSection heading={dict.account.sessions}>
        <p className="pb-2 text-body-sm text-ink-soft">{dict.account.sessionsNote}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-left text-body-sm">
            <thead>
              <tr className="border-b border-line text-ink-soft">
                <th className="py-2 font-normal">{dict.account.device}</th>
                <th className="py-2 font-normal">{dict.account.ip}</th>
                <th className="py-2 font-normal">{dict.account.signedIn}</th>
              </tr>
            </thead>
            <tbody>
              {loaded && sessions.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-ink-soft">
                    —
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-b-0">
                  <td className="py-2 text-ink">
                    {s.device}
                    {s.current && (
                      <span className="ml-2 rounded bg-[color-mix(in_srgb,var(--brain)_16%,transparent)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-brain-text">
                        {dict.account.thisDevice}
                      </span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-[0.75rem] text-ink-soft">{s.ip ?? '—'}</td>
                  <td className="py-2 text-ink-soft">
                    {new Date(s.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SettingsRow label={dict.account.signOutAll} description={dict.account.signOutAllNote}>
          <button
            type="button"
            onClick={signOutEverywhere}
            className="rounded-lg border border-line-control px-3 py-1.5 text-body-sm text-ink hover:text-sovereign-text"
          >
            {dict.account.signOut}
          </button>
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
