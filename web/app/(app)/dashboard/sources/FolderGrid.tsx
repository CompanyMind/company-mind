'use client'

import Link from 'next/link'
import { useState } from 'react'

export type FolderCard = {
  id: string
  name: string
  origin: 'manual' | 'ai'
  reviewed: boolean
  documentCount: number
}

export function FolderGrid({
  folders,
  unfiledCount,
  csrf,
  onChanged,
}: {
  folders: FolderCard[]
  unfiledCount: number
  csrf: string
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    const r = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ name: clean }),
    })
    if (!r.ok) {
      setError((await r.json().catch(() => ({}))).error ?? 'could not create folder')
      return
    }
    setName('')
    setCreating(false)
    setError(null)
    onChanged()
  }

  async function organize() {
    setOrganizing(true)
    setNote(null)
    setError(null)
    try {
      const r = await fetch('/api/folders/organize', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf },
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error ?? 'could not organise')
        return
      }
      setNote(
        `Organised ${d.organized} ${d.organized === 1 ? 'document' : 'documents'} into ${d.folders.length} ${d.folders.length === 1 ? 'folder' : 'folders'}.`,
      )
      onChanged()
    } finally {
      setOrganizing(false)
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Folders</h2>
        <div className="flex items-center">
          {unfiledCount > 0 && (
            <button
              type="button"
              onClick={organize}
              disabled={organizing}
              className="mr-3 rounded-md border border-brain px-3 py-1 text-body-sm text-brain-text disabled:opacity-60"
            >
              {organizing ? 'Organising…' : 'Organise with AI'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            {creating ? 'Cancel' : 'New folder'}
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={create} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            maxLength={60}
            className="flex-1 rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink"
          />
          <button className="rounded-md bg-ink px-4 py-2 text-body-sm text-paper">Create</button>
        </form>
      )}
      {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}
      {note && <p className="mt-2 text-body-sm text-brain-text">{note}</p>}

      {folders.length === 0 && unfiledCount === 0 && (
        <p className="mt-4 rounded-md border border-line px-4 py-6 text-body-sm text-ink-soft">
          No documents yet. Upload PDFs, Word, text or markdown above, then let CompanyMind sort
          them into folders for you.
        </p>
      )}

      <ul className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {folders.map((f) => (
          <li key={f.id}>
            <Link
              href={`/dashboard/sources/${f.id}`}
              className="block rounded-lg border border-line bg-paper-raised p-4 hover:border-brain"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-body text-ink">{f.name}</span>
                {f.origin === 'ai' && !f.reviewed && (
                  <span className="shrink-0 rounded-sm bg-[color-mix(in_srgb,var(--brain)_14%,transparent)] px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-brain-text">
                    suggested
                  </span>
                )}
              </div>
              <span className="mt-2 block font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
                {f.documentCount} {f.documentCount === 1 ? 'document' : 'documents'}
              </span>
            </Link>
          </li>
        ))}
        {unfiledCount > 0 && (
          <li>
            <Link
              href="/dashboard/sources/unfiled"
              className="block rounded-lg border border-dashed border-line bg-paper p-4 hover:border-brain"
            >
              <span className="text-body text-ink-soft">Unfiled</span>
              <span className="mt-2 block font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-ink-soft">
                {unfiledCount} {unfiledCount === 1 ? 'document' : 'documents'}
              </span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  )
}
