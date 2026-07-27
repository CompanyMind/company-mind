'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function FolderHeader({
  id,
  name,
  csrf,
  canManage,
}: {
  id: string
  name: string
  csrf: string
  /** Owner. Renaming and deleting a folder are owner-only at the API. */
  canManage: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const clean = value.trim()
    if (!clean || clean === name) {
      setEditing(false)
      return
    }
    const r = await fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ name: clean }),
    })
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? 'could not rename')
      return
    }
    setEditing(false)
    setError(null)
    router.refresh()
  }

  async function remove() {
    if (
      !confirm(
        `Delete the folder “${name}”?\n\nThe documents inside it are NOT deleted — they move to Unfiled.`,
      )
    ) {
      return
    }
    const r = await fetch(`/api/folders/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf },
    })
    if (r.ok) router.push('/dashboard/sources')
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      {editing ? (
        <form onSubmit={save} className="flex flex-1 gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={60}
            className="flex-1 rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
          />
          <button className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper">Save</button>
        </form>
      ) : (
        <h1 className="font-display text-2xl text-ink">{name}</h1>
      )}
      {canManage && (
        <div className="flex shrink-0 gap-3 text-body-sm text-ink-soft">
          <button onClick={() => setEditing((v) => !v)} className="underline underline-offset-2 hover:text-ink">
            {editing ? 'Cancel' : 'Rename'}
          </button>
          <button onClick={remove} className="underline underline-offset-2 hover:text-sovereign-text">
            Delete
          </button>
        </div>
      )}
      {error && <p className="text-body-sm text-sovereign-text">{error}</p>}
    </div>
  )
}
