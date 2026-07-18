'use client'

import { useCallback, useEffect, useState } from 'react'

type WsUser = { id: string; email: string; name: string | null }
type Group = { id: string; name: string; isDefault: boolean; memberUserIds: string[] }

export function AccessManager({ csrf }: { csrf: string }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [users, setUsers] = useState<WsUser[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    load()
  }

  function label(u: WsUser) {
    return u.name ? `${u.name} · ${u.email}` : u.email
  }

  return (
    <div className="mt-6">
      <p className="mb-4 text-body-sm text-ink-soft">
        Groups control which documents a person can see. Owners always see everything; members see
        only documents shared with a group they belong to.
      </p>

      <form onSubmit={create} className="mb-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New group name (e.g. Finance)"
          className="min-w-0 flex-1 rounded-md border border-line-control bg-paper-raised px-3 py-2 text-body text-ink"
        />
        <button className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-50" disabled={!newName.trim()}>
          Add group
        </button>
      </form>
      {error && <p className="mb-4 text-body-sm text-sovereign-text">{error}</p>}

      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.id} className="rounded-lg border border-line bg-paper-raised p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[0.8125rem] uppercase tracking-[0.08em] text-ink">
                {g.name}
                {g.isDefault && <span className="ml-2 text-ink-soft">(default · everyone)</span>}
              </span>
              {!g.isDefault && (
                <button
                  onClick={() => remove(g)}
                  className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-sovereign-text"
                >
                  Delete
                </button>
              )}
            </div>
            {!g.isDefault && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {users.length === 0 && (
                  <span className="text-body-sm text-ink-soft">No members in this workspace yet.</span>
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
