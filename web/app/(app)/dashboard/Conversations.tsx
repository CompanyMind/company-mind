'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

export function Conversations({
  csrf,
  selectedChatId,
  onSelectChat,
  reloadSignal,
}: {
  csrf: string
  selectedChatId: string | null
  onSelectChat: (id: string | null) => void
  reloadSignal: number
}) {
  const [chats, setChats] = useState<Chat[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const suppressBlur = useRef(false)

  const refresh = useCallback(async (q: string) => {
    const url = q.trim() ? `/api/chats?q=${encodeURIComponent(q.trim())}` : '/api/chats'
    const r = await fetch(url)
    if (r.ok) setChats((await r.json()).chats ?? [])
    setLoaded(true)
  }, [])

  // Instant refresh whenever the parent bumps reloadSignal (e.g. a new thread
  // was just created and needs to show up + get selected).
  useEffect(() => {
    refresh(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal])

  // Debounced refresh while the user types in the search box.
  useEffect(() => {
    const t = setTimeout(() => refresh(query), 250)
    return () => clearTimeout(t)
  }, [query, refresh])

  function startEdit(c: Chat, e: React.MouseEvent) {
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
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return
    const r = await fetch(`/api/chats/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrf },
    })
    if (!r.ok) return
    setChats((cs) => {
      const next = cs.filter((c) => c.id !== id)
      if (selectedChatId === id) onSelectChat(next[0]?.id ?? null)
      return next
    })
  }

  return (
    <div className="flex h-full w-64 flex-col px-3 py-4">
      <h2 className="sr-only">Conversations</h2>
      <button
        type="button"
        onClick={() => onSelectChat(null)}
        className="w-full rounded-md bg-ink px-3 py-2 text-body-sm text-paper"
      >
        + New chat
      </button>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search chats…"
        className="mt-3 w-full rounded-md border border-line-control bg-paper px-3 py-1.5 text-body-sm text-ink placeholder:text-ink-soft"
      />
      <ul className="mt-3 flex-1 space-y-0.5 overflow-y-auto">
        {loaded && chats.length === 0 && (
          <li className="px-3 py-6 text-center text-body-sm text-ink-soft">
            {query.trim() ? 'No matches.' : 'No conversations yet.'}
          </li>
        )}
        {chats.map((c) => {
          const isActive = c.id === selectedChatId
          const isEditing = editingId === c.id
          return (
            <li key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelectChat(c.id)}
                className={`flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 pr-8 text-left transition-colors ${
                  isActive ? 'bg-paper-sunk' : 'hover:bg-paper-raised'
                }`}
              >
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
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
                    className="w-full rounded-sm border border-brain bg-paper px-1 py-0.5 text-body-sm text-ink"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startEdit(c, e)}
                    className={`w-full truncate text-body-sm ${isActive ? 'text-brain-text' : 'text-ink'}`}
                    title={c.title ?? 'New chat'}
                  >
                    {c.title || 'New chat'}
                  </span>
                )}
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
                  {relativeTime(c.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(c.id, e)}
                aria-label="Delete conversation"
                className={`absolute right-2 top-2 h-5 w-5 items-center justify-center rounded-sm text-ink-soft hover:text-sovereign-text group-hover:flex ${
                  isActive ? 'flex' : 'hidden'
                }`}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
