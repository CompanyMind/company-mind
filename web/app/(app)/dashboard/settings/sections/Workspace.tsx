'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n'
import { SettingsRow, SettingsSection, inputClass } from '../SettingsRow'

export function Workspace({
  csrf,
  dict,
  name,
  deploymentMode,
}: {
  csrf: string
  dict: Dictionary['settings']
  name: string
  /** Presentation only — see lib/env.ts. Decides what the deployment row
   *  CLAIMS, never what anything allows. */
  deploymentMode: 'hosted' | 'onprem'
}) {
  const router = useRouter()
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)

  async function commit() {
    const clean = value.trim()
    if (!clean || clean === name) {
      setValue(name)
      return
    }
    setError(null)
    const r = await fetch('/api/workspace', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ name: clean }),
    })
    if (!r.ok) {
      setError(dict.saveFailed)
      setValue(name)
      return
    }
    // The sidebar shows the workspace name under the user pill.
    router.refresh()
  }

  const LINKS = [
    { href: '/dashboard/people', label: dict.workspace.people, note: dict.workspace.peopleNote },
    { href: '/dashboard/access', label: dict.workspace.access, note: dict.workspace.accessNote },
    {
      href: '/dashboard/integrations',
      label: dict.workspace.integrations,
      note: dict.workspace.integrationsNote,
    },
  ]

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 text-body-sm text-sovereign-text">
          {error}
        </p>
      )}

      <SettingsSection heading={dict.workspace.heading}>
        <SettingsRow label={dict.workspace.name} htmlFor="settings-workspace-name">
          <input
            id="settings-workspace-name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            maxLength={120}
            className={`${inputClass} md:w-64`}
          />
        </SettingsRow>
        {/* The claim differs by mode and must stay true in both — the same two
            strings the sidebar's egress line uses. A hosted deployment must
            never make the on-prem claim. */}
        <SettingsRow label={dict.workspace.deployment}>
          <span className="text-body-sm text-ink-soft">
            {deploymentMode === 'onprem' ? dict.workspace.onprem : dict.workspace.hosted}
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* Doorways, not a second implementation: each of these pages owns its own
          route, its own owner gate and its own logic. */}
      <SettingsSection heading={dict.workspace.manage}>
        {LINKS.map((l) => (
          <SettingsRow key={l.href} label={l.label} description={l.note}>
            <Link
              href={l.href}
              className="inline-block rounded-lg border border-line-control px-3 py-1.5 text-body-sm text-ink hover:bg-paper-sunk"
            >
              {dict.workspace.open}
            </Link>
          </SettingsRow>
        ))}
      </SettingsSection>
    </>
  )
}
