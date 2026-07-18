'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Doc = {
  id: string
  filename: string
  status: 'uploaded' | 'parsing' | 'indexed' | 'failed'
  error: string | null
  bytes: number
}

const STATUS_LABEL: Record<Doc['status'], string> = {
  uploaded: 'Queued',
  parsing: 'Indexing…',
  indexed: 'Indexed',
  failed: 'Failed',
}

export function Sources({ csrf }: { csrf: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/documents')
    if (r.ok) setDocs((await r.json()).documents)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 2500)
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

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">Sources</h2>
        <label className="cursor-pointer rounded-md bg-ink px-4 py-2 text-body-sm text-paper">
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
          <li key={d.id} className="flex items-center justify-between px-4 py-3">
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
          </li>
        ))}
      </ul>
    </section>
  )
}
