'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PersonRow } from '@/lib/people'

type Serialised = Omit<PersonRow, 'createdAt' | 'lastSeenAt'> & {
  createdAt: string | Date
  lastSeenAt: string | Date | null
}

type Handover = { heading: string; email: string; password: string }

function when(value: string | Date | null): string {
  if (!value) return 'never'
  return new Date(value).toLocaleDateString()
}

export function PeoplePanel({
  csrf,
  initialPeople,
  currentUserId,
}: {
  csrf: string
  initialPeople: Serialised[]
  currentUserId: string
}) {
  const router = useRouter()
  const [people, setPeople] = useState(initialPeople)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'member' | 'owner'>('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handover, setHandover] = useState<Handover | null>(null)

  async function refresh() {
    const r = await fetch('/api/people')
    if (r.ok) setPeople((await r.json()).people)
    router.refresh()
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setHandover(null)
    try {
      const r = await fetch('/api/people', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ email, name: name || null, role }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? 'could not create that account')
        return
      }
      setHandover({ heading: 'Account created', email, password: d.tempPassword })
      setEmail('')
      setName('')
      setRole('member')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function toggleBlock(p: Serialised) {
    const blocking = !p.blocked
    if (
      blocking &&
      !confirm(
        `Block ${p.email}?\n\nThey are signed out immediately and cannot sign back in. Their documents and chats are not deleted.`,
      )
    ) {
      return
    }
    const r = await fetch(`/api/people/${p.id}/block`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ blocked: blocking }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setError(d.error ?? 'could not change that account')
      return
    }
    await refresh()
  }

  async function resetPassword(p: Serialised) {
    if (!confirm(`Reset the password for ${p.email}?\n\nThey will be signed out everywhere.`)) return
    const r = await fetch(`/api/people/${p.id}/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      setError(d.error ?? 'could not reset that password')
      return
    }
    setHandover({ heading: `New password for ${p.email}`, email: p.email, password: d.tempPassword })
  }

  return (
    <>
      <form
        onSubmit={create}
        className="rounded-lg border border-line bg-paper-raised p-4 shadow-card"
      >
        <h2 className="font-display text-lg text-ink">Add someone</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <label className="block">
            <span className="text-body-sm text-ink-soft">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="person@yourfirm.example"
              className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            />
          </label>
          <label className="block">
            <span className="text-body-sm text-ink-soft">Name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            />
          </label>
          <label className="block">
            <span className="text-body-sm text-ink-soft">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value === 'owner' ? 'owner' : 'member')}
              className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            >
              <option value="member">Member — sees only their access groups</option>
              <option value="owner">Owner — sees everything, can manage people</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-body-sm text-sovereign-text">
          {error}
        </p>
      )}

      {handover && (
        <div className="mt-4 rounded-lg border border-brain bg-paper-sunk p-4">
          <h3 className="font-display text-lg text-ink">{handover.heading}</h3>
          <p className="mt-1 text-body-sm text-ink-soft">
            Hand these over directly.{' '}
            <strong className="text-ink">This password is shown once</strong> and cannot be retrieved
            — there is no email delivery yet. They will be asked to choose their own the first time
            they sign in.
          </p>
          <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-body-sm">
            <dt className="text-ink-soft">email</dt>
            <dd className="text-ink">{handover.email}</dd>
            <dt className="text-ink-soft">password</dt>
            <dd className="select-all text-ink">{handover.password}</dd>
          </dl>
          <button
            onClick={() => setHandover(null)}
            className="mt-3 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            I&rsquo;ve saved it
          </button>
        </div>
      )}

      <h2 className="mt-8 font-display text-lg text-ink">Everyone here</h2>
      <ul className="mt-3 space-y-2">
        {people.map((p) => (
          <li key={p.id} className="rounded-lg border border-line bg-paper-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-body text-ink">
                  {p.name ? `${p.name} · ${p.email}` : p.email}
                  {p.blocked && (
                    <span className="ml-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-sovereign-text">
                      blocked
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-body-sm text-ink-soft">
                  {p.role} · last seen {when(p.lastSeenAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-body-sm">
                <button
                  onClick={() => resetPassword(p)}
                  className="text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  Reset password
                </button>
                {/* No self-block control at all: the API refuses it, and an
                    offered button that always fails is worse than its absence. */}
                {p.id !== currentUserId && (
                  <button
                    onClick={() => toggleBlock(p)}
                    className="text-ink-soft underline underline-offset-2 hover:text-sovereign-text"
                  >
                    {p.blocked ? 'Unblock' : 'Block'}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
