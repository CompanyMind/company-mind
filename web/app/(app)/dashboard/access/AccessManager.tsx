'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'

type WsUser = { id: string; email: string; name: string | null }
type Group = {
  id: string
  name: string
  isDefault: boolean
  memberUserIds: string[]
  documentCount: number
}

export function AccessManager({ csrf, dict }: { csrf: string; dict: Dictionary }) {
  const t = dict.panels.access
  const [groups, setGroups] = useState<Group[]>([])
  const [users, setUsers] = useState<WsUser[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // Deleting a group changes what everyone in it can retrieve, so it asks —
  // inline, in the reader's language, naming what is at stake.
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch('/api/groups')
    if (r.ok) {
      const d = await r.json()
      setGroups(d.groups)
      setUsers(d.users)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const post = (url: string, method: string, body?: unknown) =>
    fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: body ? JSON.stringify(body) : undefined,
    })

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setError(null)
    const r = await post('/api/groups', 'POST', { name })
    if (r.ok) {
      setNewName('')
      load()
    } else setError((await r.json().catch(() => ({}))).error ?? 'could not create group')
  }

  async function toggleMember(group: Group, userId: string) {
    const has = group.memberUserIds.includes(userId)
    const userIds = has
      ? group.memberUserIds.filter((u) => u !== userId)
      : [...group.memberUserIds, userId]
    setGroups((gs) => gs.map((g) => (g.id === group.id ? { ...g, memberUserIds: userIds } : g)))
    await post(`/api/groups/${group.id}/members`, 'PUT', { userIds })
  }

  async function remove(group: Group) {
    await post(`/api/groups/${group.id}`, 'DELETE')
    setConfirming(null)
    load()
  }

  async function commitRename(group: Group) {
    const name = renameValue.trim()
    setRenaming(null)
    if (!name || name === group.name) return
    await post(`/api/groups/${group.id}`, 'PATCH', { name })
    load()
  }

  function label(u: WsUser) {
    return u.name ? `${u.name} · ${u.email}` : u.email
  }

  return (
    <div className="mt-6">
      {/* The paragraph that used to sit here said the same thing as the
          permanent explanation directly above it on the page — two
          restatements of one rule, stacked. The one above is the spec-mandated
          copy that must never leave the page, so this one goes. */}
      <form onSubmit={create} className="mb-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t.newGroupPlaceholder}
          className="min-w-0 flex-1 rounded-md border border-line-control bg-paper-raised px-3 py-2 text-body text-ink"
        />
        <button className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-50" disabled={!newName.trim()}>
          {t.addGroup}
        </button>
      </form>
      {error && <p className="mb-4 text-body-sm text-sovereign-text">{error}</p>}

      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.id} className="rounded-lg border border-line bg-paper-raised p-4">
            <div className="flex items-center gap-3">
              {renaming === g.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(g)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename(g)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setRenaming(null)
                    }
                  }}
                  aria-label={t.renameGroup.replace('{name}', g.name)}
                  className="min-w-0 flex-1 rounded-md border border-brain bg-paper px-2 py-1 text-body text-ink"
                />
              ) : (
                <button
                  type="button"
                  disabled={g.isDefault}
                  onClick={() => {
                    setRenameValue(g.name)
                    setRenaming(g.id)
                  }}
                  title={g.isDefault ? undefined : t.renameGroup.replace('{name}', g.name)}
                  /* Sentence case, not mono-uppercase. These are words a person
                     chose — "Finance", "Exec-only" — and shouting them in a
                     monospace face turned them into system identifiers. */
                  className="min-w-0 flex-1 truncate rounded-md px-1 py-0.5 text-left text-body font-medium text-ink enabled:hover:bg-paper-sunk"
                >
                  {g.name}
                  {g.isDefault && (
                    <span className="ml-2 text-body-sm font-normal text-ink-soft">
                      {t.defaultEveryone}
                    </span>
                  )}
                </button>
              )}
              {/* The number this page exists to show. */}
              <span className="shrink-0 text-body-sm tabular-nums text-ink-soft">
                {(g.documentCount === 1 ? t.opensOne : t.opens).replace(
                  '{count}',
                  String(g.documentCount),
                )}
              </span>
              {!g.isDefault && confirming !== g.id && (
                <button
                  onClick={() => setConfirming(g.id)}
                  aria-label={t.deleteGroupAria.replace('{name}', g.name)}
                  className="shrink-0 text-body-sm text-ink-soft underline underline-offset-2 hover:text-sovereign-text"
                >
                  {t.delete}
                </button>
              )}
            </div>

            {confirming === g.id && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-sovereign bg-[color-mix(in_srgb,var(--sovereign)_8%,transparent)] px-3 py-2 text-body-sm">
                <span className="text-ink">
                  {t.deleteGroupConfirm
                    .replace('{name}', g.name)
                    .replace('{count}', String(g.documentCount))}
                </span>
                <button
                  onClick={() => remove(g)}
                  className="ml-auto rounded-md bg-sovereign px-2.5 py-1 text-paper"
                >
                  {t.delete}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  {t.cancelDelete}
                </button>
              </div>
            )}
            {!g.isDefault && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {users.length === 0 && (
                  <span className="text-body-sm text-ink-soft">{t.noMembers}</span>
                )}
                {users.map((u) => {
                  const on = g.memberUserIds.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMember(g, u.id)}
                      data-on={on}
                      className="rounded-md border border-line px-2.5 py-1 text-body-sm text-ink-soft data-[on=true]:border-brain data-[on=true]:bg-[color-mix(in_srgb,var(--brain)_12%,transparent)] data-[on=true]:text-brain-text"
                    >
                      {on ? '✓ ' : ''}
                      {label(u)}
                    </button>
                  )
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
