'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The bar above an open thread: its title, renamable in place, and a delete
 * control. The old chat-list sidebar carried both of these; when it merged into
 * the app sidebar the rename stayed there (double-click a row) but a thread you
 * are actually reading deserves its name at the top of it, not only in a list.
 */
export function ThreadHeader({
  csrf,
  chatId,
  title,
}: {
  csrf: string
  chatId: string
  title: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(title ?? '')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function commit() {
    setEditing(false)
    const clean = value.trim()
    if (!clean || clean === (title ?? '')) {
      setValue(title ?? '')
      return
    }
    await fetch(`/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ title: clean }),
    })
    // The sidebar's Recents list is a server-rendered sibling — this is what
    // makes the rename show up there too.
    router.refresh()
  }

  async function remove() {
    if (!window.confirm('Delete this conversation?')) return
    setBusy(true)
    const r = await fetch(`/api/chats/${chatId}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf },
    })
    if (!r.ok) {
      setBusy(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-6">
      <div className="mx-auto flex w-full max-w-[var(--chat-measure)] items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setValue(title ?? '')
                setEditing(false)
              }
            }}
            aria-label="Conversation title"
            className="min-w-0 flex-1 rounded-md border border-brain bg-paper px-2 py-1 text-body-sm text-ink"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Rename this conversation"
            className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-body-sm text-ink hover:bg-paper-raised"
          >
            {title || 'New chat'}
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label="Delete this conversation"
          className="shrink-0 rounded-md px-2 py-1 text-body-sm text-ink-soft hover:text-sovereign-text disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </header>
  )
}
