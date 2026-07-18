'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Doc = {
  id: string
  filename: string
  status: 'uploaded' | 'parsing' | 'indexed' | 'failed'
  error: string | null
  bytes: number
  groupIds: string[]
}
type Group = { id: string; name: string; isDefault: boolean }

const STATUS_LABEL: Record<Doc['status'], string> = {
  uploaded: 'Queued',
  parsing: 'Indexing…',
  indexed: 'Indexed',
  failed: 'Failed',
}

export function Sources({ csrf }: { csrf: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const [dr, gr] = await Promise.all([fetch('/api/documents'), fetch('/api/groups')])
    if (dr.ok) setDocs((await dr.json()).documents)
    if (gr.ok) setGroups((await gr.json()).groups)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(() => {
      // Only poll document status, not while editing visibility.
      fetch('/api/documents').then((r) => (r.ok ? r.json() : null)).then((d) => d && setDocs(d.documents))
    }, 2500)
    return () => clearInterval(t)
  }, [refresh])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.set('file', file)
        const r = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'x-csrf-token': csrf },
          body,
        })
        if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? 'upload failed')
      }
      await refresh()
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function toggleGroup(doc: Doc, groupId: string) {
    const has = doc.groupIds.includes(groupId)
    const groupIds = has ? doc.groupIds.filter((g) => g !== groupId) : [...doc.groupIds, groupId]
    setDocs((ds) => ds.map((d) => (d.id === doc.id ? { ...d, groupIds } : d)))
    await fetch(`/api/documents/${doc.id}/groups`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ groupIds }),
    })
  }

  function visibleLabel(doc: Doc) {
    const names = groups.filter((g) => doc.groupIds.includes(g.id)).map((g) => g.name)
    return names.length ? names.join(', ') : 'No one'
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="sr-only">Documents</h2>
        <label className="ml-auto cursor-pointer rounded-md bg-ink px-4 py-2 text-body-sm text-paper">
          {busy ? 'Uploading…' : 'Upload documents'}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}
      <ul className="mt-4 divide-y divide-line rounded-md border border-line">
        {docs.length === 0 && (
          <li className="px-4 py-6 text-body-sm text-ink-soft">
            No documents yet. Upload PDFs, Word, text, or markdown to build this workspace’s brain.
          </li>
        )}
        {docs.map((d) => (
          <li key={d.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="truncate text-body text-ink">{d.filename}</span>
              <span
                className={
                  d.status === 'indexed'
                    ? 'text-body-sm text-brain-text'
                    : d.status === 'failed'
                      ? 'text-body-sm text-sovereign-text'
                      : 'text-body-sm text-ink-soft'
                }
                title={d.error ?? undefined}
              >
                {STATUS_LABEL[d.status]}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-body-sm text-ink-soft">
              <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em]">
                visible to: {visibleLabel(d)}
              </span>
              <button
                onClick={() => setEditing(editing === d.id ? null : d.id)}
                className="underline underline-offset-2 hover:text-ink"
              >
                {editing === d.id ? 'done' : 'edit'}
              </button>
            </div>
            {editing === d.id && (
              <div className="mt-2 flex flex-wrap gap-2">
                {groups.map((g) => {
                  const on = d.groupIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGroup(d, g.id)}
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
  )
}
