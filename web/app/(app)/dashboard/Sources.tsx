'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderGrid, type FolderCard } from './sources/FolderGrid'
import { useDocumentUpload } from '@/lib/useDocumentUpload'

export function Sources({ csrf }: { csrf: string }) {
  const [folders, setFolders] = useState<FolderCard[]>([])
  const [unfiledCount, setUnfiledCount] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload, busy, error } = useDocumentUpload(csrf)

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
    try {
      await upload(files)
      await refresh()
    } finally {
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
