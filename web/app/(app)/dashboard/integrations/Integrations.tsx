'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n'

type Group = { id: string; name: string }
type Link = {
  id: string
  telegramUsername: string | null
  displayName: string | null
  status: string
  groupIds: string[]
}
type Status = { connected: boolean; username: string | null }

export function Integrations({ csrf, dict }: { csrf: string; dict: Dictionary }) {
  const t = dict.panels.integrations
  const [status, setStatus] = useState<Status>({ connected: false, username: null })
  const [links, setLinks] = useState<Link[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/integrations/telegram')
    if (r.ok) {
      const d = await r.json()
      setStatus(d.telegram)
      setLinks(d.links)
      setGroups(d.groups)
    }
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  const send = (url: string, method: string, body?: unknown) =>
    fetch(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: body ? JSON.stringify(body) : undefined,
    })

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await send('/api/integrations/telegram', 'POST', { token: token.trim() })
    if (r.ok) {
      setToken('')
      load()
    } else setError((await r.json().catch(() => ({}))).error ?? 'could not connect')
    setBusy(false)
  }

  async function disconnect() {
    await send('/api/integrations/telegram', 'DELETE')
    load()
  }

  async function act(link: Link, action: 'approve' | 'block') {
    setLinks((ls) =>
      ls.map((l) => (l.id === link.id ? { ...l, status: action === 'approve' ? 'approved' : 'blocked' } : l)),
    )
    await send(`/api/telegram-links/${link.id}`, 'POST', { action })
    load()
  }

  async function toggleGroup(link: Link, groupId: string) {
    const has = link.groupIds.includes(groupId)
    const groupIds = has ? link.groupIds.filter((g) => g !== groupId) : [...link.groupIds, groupId]
    setLinks((ls) => ls.map((l) => (l.id === link.id ? { ...l, groupIds } : l)))
    await send(`/api/telegram-links/${link.id}/groups`, 'PUT', { groupIds })
  }

  const person = (l: Link) =>
    l.displayName || (l.telegramUsername ? `@${l.telegramUsername}` : t.telegramUser)

  return (
    <div className="mt-6 space-y-8">
      {/* Telegram connection */}
      <section className="rounded-lg border border-line bg-paper-raised p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">{t.telegram}</h2>
          {status.connected && (
            <span className="font-mono text-[0.75rem] text-brain-text">@{status.username} · {t.connected}</span>
          )}
        </div>
        <p className="mt-1 text-body-sm text-ink-soft">
          {t.telegramBody}
        </p>
        {status.connected ? (
          <button
            onClick={disconnect}
            className="mt-4 rounded-md border border-line-control px-3 py-1.5 text-body-sm text-ink-soft hover:text-sovereign-text"
          >
            {t.disconnect}
          </button>
        ) : (
          <form onSubmit={connect} className="mt-4 flex gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t.tokenPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-line-control bg-paper px-3 py-2 font-mono text-body-sm text-ink"
            />
            <button
              disabled={busy || !token.trim()}
              className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-50"
            >
              {busy ? t.connecting : t.connect}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}
        <p className="mt-3 border-t border-line pt-3 text-body-sm text-ink-soft">
          {t.telegramNote}
        </p>
      </section>

      {/* Access requests */}
      <section>
        <h2 className="font-display text-lg text-ink">{t.accessRequests}</h2>
        <p className="mt-1 text-body-sm text-ink-soft">
          {t.accessRequestsBody}
        </p>
        <ul className="mt-4 space-y-3">
          {links.length === 0 && (
            <li className="rounded-md border border-line px-4 py-6 text-body-sm text-ink-soft">
              {t.noneStarted}
            </li>
          )}
          {links.map((l) => (
            <li key={l.id} className="rounded-lg border border-line bg-paper-raised p-4">
              <div className="flex items-center justify-between">
                <span className="text-body text-ink">{person(l)}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      l.status === 'approved'
                        ? 'font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-brain-text'
                        : l.status === 'blocked'
                          ? 'font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-sovereign-text'
                          : 'font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-query-text'
                    }
                  >
                    {l.status}
                  </span>
                  {l.status !== 'approved' && (
                    <button onClick={() => act(l, 'approve')} className="text-body-sm text-brain-text underline">
                      {t.approve}
                    </button>
                  )}
                  {l.status !== 'blocked' && (
                    <button onClick={() => act(l, 'block')} className="text-body-sm text-ink-soft underline hover:text-sovereign-text">
                      {t.blockAction}
                    </button>
                  )}
                </div>
              </div>
              {l.status === 'approved' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {groups.map((g) => {
                    const on = l.groupIds.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        onClick={() => toggleGroup(l, g.id)}
                        data-on={on}
                        className="rounded-md border border-line px-2.5 py-1 text-body-sm text-ink-soft data-[on=true]:border-brain data-[on=true]:bg-[color-mix(in_srgb,var(--brain)_12%,transparent)] data-[on=true]:text-brain-text"
                      >
                        {on ? '✓ ' : ''}
                        {g.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
