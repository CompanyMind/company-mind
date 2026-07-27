'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

type Chat = { id: string; title: string | null; updatedAt: string }

function relativeTime(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  const min = Math.round(diffSec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The chat list, lifted out of the old second sidebar and into the one true
 * sidebar. Selection is no longer a prop from a sibling — each row is a real
 * link to /dashboard/c/[id] and the active row is read from the pathname, so
 * this component works identically on every route in the shell.
 */
export function Recents({ csrf, searchOpen }: { csrf: string; searchOpen: boolean }) {
  const router = useRouter()
  const path = usePathname()
  const [chats, setChats] = useState<Chat[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const suppressBlur = useRef(false)

  const openId = path.startsWith('/dashboard/c/') ? path.slice('/dashboard/c/'.length) : null

  const refresh = useCallback(async (q: string) => {
    const url = q.trim() ? `/api/chats?q=${encodeURIComponent(q.trim())}` : '/api/chats'
    const r = await fetch(url)
    if (r.ok) setChats((await r.json()).chats ?? [])
    setLoaded(true)
  }, [])

  // Debounced refresh while the user types in the search box. The old
  // `reloadSignal` prop is gone: a newly created thread arrives via
  // router.refresh() re-rendering the layout, not via a counter passed down
  // from the chat pane.
  useEffect(() => {
    const t = setTimeout(() => refresh(query), 250)
    return () => clearTimeout(t)
  }, [query, refresh])

  // A thread created in this session changes the pathname, which is the
  // cheapest available signal that the list is now stale.
  useEffect(() => {
    refresh(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  function startEdit(c: Chat, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(c.id)
    setEditValue(c.title ?? '')
  }

  function cancelEdit() {
    suppressBlur.current = true
    setEditingId(null)
  }

  async function commitEdit(id: string) {
    if (editingId !== id) return
    const clean = editValue.trim()
    setEditingId(null)
    if (!clean) return
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, title: clean } : c)))
    await fetch(`/api/chats/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ title: clean }),
    })
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return
    const r = await fetch(`/api/chats/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf },
    })
    if (!r.ok) return
    setChats((cs) => cs.filter((c) => c.id !== id))
    // Deleting the thread you are reading has to take you somewhere. The new
    // chat surface is the only place that is always valid.
    if (openId === id) router.push('/dashboard')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {searchOpen && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats…"
          className="mb-2 w-full rounded-lg border border-line-control bg-paper px-3 py-1.5 text-body-sm text-ink placeholder:text-ink-soft"
        />
      )}
      <p className="px-2.5 pb-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-soft">
        Recents
      </p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {loaded && chats.length === 0 && (
          <li className="px-2.5 py-4 text-body-sm text-ink-soft">
            {query.trim() ? 'No matches.' : 'No conversations yet.'}
          </li>
        )}
        {chats.map((c) => {
          const isEditing = editingId === c.id
          return (
            <li key={c.id} className="group relative">
              {isEditing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitEdit(c.id)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelEdit()
                    }
                  }}
                  onBlur={() => {
                    if (suppressBlur.current) {
                      suppressBlur.current = false
                      return
                    }
                    commitEdit(c.id)
                  }}
                  className="w-full rounded-lg border border-brain bg-paper px-2.5 py-1.5 text-body-sm text-ink"
                />
              ) : (
                <>
                  <Link
                    href={`/dashboard/c/${c.id}`}
                    data-active={c.id === openId}
                    onDoubleClick={(e) => startEdit(c, e)}
                    title={c.title ?? 'New chat'}
                    className="recent-link truncate pr-7"
                  >
                    {c.title || 'New chat'}
                    <span className="sr-only"> — {relativeTime(c.updatedAt)}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(c.id, e)}
                    aria-label={`Delete conversation: ${c.title ?? 'New chat'}`}
                    className={`absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded text-ink-soft hover:text-sovereign-text focus-visible:flex group-hover:flex ${
                      c.id === openId ? 'flex' : ''
                    }`}
                  >
                    ×
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
