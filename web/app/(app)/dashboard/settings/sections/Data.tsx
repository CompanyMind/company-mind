'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n'
import { SettingsRow, SettingsSection } from '../SettingsRow'

export function Data({
  csrf,
  dict,
  onClose,
}: {
  csrf: string
  dict: Dictionary['settings']
  onClose: () => void
}) {
  const router = useRouter()
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/chats')
    if (r.ok) setCount(((await r.json()).chats ?? []).length)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function deleteAll() {
    if (count === 0) {
      window.alert(dict.data.deleteChatsNone)
      return
    }
    // Names the exact number. "Delete everything?" with no quantity is how
    // people click through a destructive confirm without reading it.
    if (!window.confirm(dict.data.deleteChatsConfirm.replace('{count}', String(count ?? 0)))) return
    setBusy(true)
    const r = await fetch('/api/chats', { method: 'DELETE', headers: { 'x-csrf-token': csrf } })
    setBusy(false)
    if (!r.ok) return
    setCount(0)
    onClose()
    // Back to the new-chat surface, and refresh so the sidebar's Recents empties.
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <SettingsSection heading={dict.data.heading}>
        <div className="border-b border-line py-4">
          <p className="text-body text-ink">{dict.data.stored}</p>
          <p className="mt-1 max-w-prose text-body-sm text-ink-soft">{dict.data.storedBody}</p>
        </div>
      </SettingsSection>

      <SettingsSection heading={dict.data.conversations}>
        <SettingsRow label={dict.data.deleteChats} description={dict.data.deleteChatsNote}>
          <button
            type="button"
            onClick={deleteAll}
            disabled={busy || count === null}
            className="rounded-lg border border-line-control px-3 py-1.5 text-body-sm text-sovereign-text hover:bg-[color-mix(in_srgb,var(--sovereign)_10%,transparent)] disabled:opacity-50"
          >
            {dict.data.delete}
            {count !== null ? ` (${count})` : ''}
          </button>
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
