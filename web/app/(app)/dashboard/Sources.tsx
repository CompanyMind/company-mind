'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getDictionary, isLocale } from '@/lib/i18n'
import { FolderGrid, type FolderCard } from './sources/FolderGrid'
import { useDocumentUpload } from '@/lib/useDocumentUpload'

export function Sources({
  csrf,
  locale,
  canManage,
}: {
  csrf: string
  locale: string
  /** Owner. Upload, folder CRUD and AI organise are all owner-only at the API
   *  now, so rendering them to a member would only produce a 403 they cannot
   *  act on. The gate is the API; this just stops offering the dead control. */
  canManage: boolean
}) {
  const dict = getDictionary(isLocale(locale) ? locale : 'en')
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
      {canManage && (
        <div className="mt-6 flex items-center justify-end">
          {/* sr-only, never `hidden`: display:none removes the input from the tab
              order entirely, so a keyboard-only user could never reach the file
              chooser (WCAG 2.1 SC 2.1.1, Level A). Same fix already applied to
              the tour's UploadStep; this was the last instance of the bug. */}
          <label className="cursor-pointer rounded-md bg-ink px-4 py-2 text-body-sm text-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
            {busy ? 'Uploading…' : 'Upload documents'}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              className="sr-only"
              disabled={busy}
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        </div>
      )}
      {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}
      <FolderGrid
        folders={folders}
        unfiledCount={unfiledCount}
        csrf={csrf}
        onChanged={refresh}
        emptyState={dict.emptyStates.sourcesEmpty}
        onUploadClick={() => inputRef.current?.click()}
        canManage={canManage}
      />
    </>
  )
}
