'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderGrid, type FolderCard } from './sources/FolderGrid'

export function Sources({ csrf }: { csrf: string }) {
  const [folders, setFolders] = useState<FolderCard[]>([])
  const [unfiledCount, setUnfiledCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/folders')
    if (!r.ok) return
    const d = (await r.json()) as { folders: FolderCard[]; unfiledCount: number }
    setFolders(d.folders)
    setUnfiledCount(d.unfiledCount)
  }, [])

  useEffect(() => {
    refresh()
    // Documents move from 'uploaded' to 'indexed' in the background, which changes
    // the unfiled count, so keep polling while the page is open.
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
    <>
      <div className="mt-6 flex items-center justify-end">
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
      <FolderGrid
        folders={folders}
        unfiledCount={unfiledCount}
        csrf={csrf}
        onChanged={refresh}
      />
    </>
  )
}
