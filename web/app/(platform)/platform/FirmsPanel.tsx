'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FirmRow } from '@/lib/platform/firms'

type Serialised = Omit<FirmRow, 'createdAt' | 'suspendedAt'> & {
  createdAt: string | Date
  suspendedAt: string | Date | null
}

/** Shown once and never again — the panel says so where it appears, because
 *  there is no email delivery and no way to re-fetch it. */
type Handover = { heading: string; email: string; password: string; warning?: string }

export function FirmsPanel({ csrf, initialFirms }: { csrf: string; initialFirms: Serialised[] }) {
  const router = useRouter()
  const [firms, setFirms] = useState(initialFirms)
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handover, setHandover] = useState<Handover | null>(null)

  async function refresh() {
    const r = await fetch('/api/platform/firms')
    if (r.ok) setFirms((await r.json()).firms)
    router.refresh()
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setHandover(null)
    try {
      const r = await fetch('/api/platform/firms', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ name, ownerEmail, ownerName: ownerName || null }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? 'could not create the firm')
        return
      }
      setHandover({
        heading: `${name} is open for business`,
        email: ownerEmail,
        password: d.tempPassword,
        warning: d.bootstrapped
          ? undefined
          : 'The firm was created, but the engine did not confirm its default access group. It will be created on their first upload; no action needed unless the Access page looks empty.',
      })
      setName('')
      setOwnerEmail('')
      setOwnerName('')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function toggleSuspend(f: Serialised) {
    const suspending = !f.suspendedAt
    if (
      suspending &&
      !confirm(
        `Suspend ${f.name}?\n\nEveryone there is signed out immediately and cannot sign back in until you resume the firm. Their documents are not touched.`,
      )
    ) {
      return
    }
    const r = await fetch(`/api/platform/firms/${f.id}/suspend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ suspended: suspending }),
    })
    if (!r.ok) {
      setError('could not change that firm’s status')
      return
    }
    await refresh()
  }

  async function resetOwner(f: Serialised, ownerId: string, ownerEmailAddr: string) {
    if (!confirm(`Reset the password for ${ownerEmailAddr}?\n\nThey will be signed out everywhere.`))
      return
    const r = await fetch(`/api/platform/firms/${ownerId}/reset-owner-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      setError(d.error ?? 'could not reset that password')
      return
    }
    setHandover({
      heading: `New password for ${f.name}`,
      email: ownerEmailAddr,
      password: d.tempPassword,
    })
  }

  return (
    <>
      <form
        onSubmit={create}
        className="rounded-lg border border-line bg-paper-raised p-4 shadow-card"
      >
        <h2 className="font-display text-lg text-ink">Open a new firm</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <label className="block">
            <span className="text-body-sm text-ink-soft">Firm name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Acme Bank"
              className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            />
          </label>
          <label className="block">
            <span className="text-body-sm text-ink-soft">First owner&rsquo;s email</span>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              placeholder="admin@acme.example"
              className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            />
          </label>
          <label className="block">
            <span className="text-body-sm text-ink-soft">Their name (optional)</span>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-md bg-ink px-4 py-2 text-body-sm text-paper disabled:opacity-60"
        >
          {busy ? 'Opening…' : 'Open firm'}
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
            Give these to them directly. <strong className="text-ink">This password is shown
            once</strong> and cannot be retrieved again — there is no email delivery yet. They will
            be asked to choose their own the first time they sign in.
          </p>
          <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-body-sm">
            <dt className="text-ink-soft">email</dt>
            <dd className="text-ink">{handover.email}</dd>
            <dt className="text-ink-soft">password</dt>
            <dd className="select-all text-ink">{handover.password}</dd>
          </dl>
          {handover.warning && (
            <p className="mt-3 text-body-sm text-sovereign-text">{handover.warning}</p>
          )}
          <button
            onClick={() => setHandover(null)}
            className="mt-3 text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            I&rsquo;ve saved it
          </button>
        </div>
      )}

      <h2 className="mt-8 font-display text-lg text-ink">All firms</h2>
      <ul className="mt-3 space-y-2">
        {firms.length === 0 && (
          <li className="rounded-md border border-line px-4 py-6 text-center text-body-sm text-ink-soft">
            No firms yet. Open one above.
          </li>
        )}
        {firms.map((f) => (
          <li
            key={f.id}
            className="rounded-lg border border-line bg-paper-raised p-4"
            data-suspended={!!f.suspendedAt}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-body text-ink">
                  {f.name}
                  {f.suspendedAt && (
                    <span className="ml-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-sovereign-text">
                      suspended
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-body-sm text-ink-soft">
                  {f.userCount} {f.userCount === 1 ? 'person' : 'people'}
                  {f.owners.length > 0 && ` · ${f.owners.map((o) => o.email).join(', ')}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-body-sm">
                {f.owners.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => resetOwner(f, o.id, o.email)}
                    className="text-ink-soft underline underline-offset-2 hover:text-ink"
                  >
                    Reset {f.owners.length > 1 ? o.email : 'owner password'}
                  </button>
                ))}
                <button
                  onClick={() => toggleSuspend(f)}
                  className="text-ink-soft underline underline-offset-2 hover:text-sovereign-text"
                >
                  {f.suspendedAt ? 'Resume' : 'Suspend'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
