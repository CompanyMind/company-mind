import { useCallback, useState } from 'react'

/**
 * Shared upload path for the Sources page and the guided tour's upload step —
 * one implementation so the two surfaces can't drift apart from the server's
 * contract. Posts each file individually to `POST /api/documents` as
 * `FormData`, sequentially (not `Promise.all`: the ingest path holds a
 * database connection per request).
 *
 * The hook owns `busy` and `error`. It does NOT refresh anything afterwards —
 * that's the caller's business, and Sources and the tour do different things
 * once an upload finishes.
 */
/** The document record `POST /api/documents` returns for an accepted file. */
export type UploadedDoc = { id: string; filename: string; status: string }

export function useDocumentUpload(csrf: string) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(0)

  const upload = useCallback(
    async (
      files: FileList | File[],
      /** Called once per accepted file, as soon as the server confirms it.
       *  Optional and additive: the Sources page and the tour both ignore the
       *  result entirely, while the composer needs each document's id so it can
       *  show a card per file and follow it from uploaded to indexed. */
      onFile?: (doc: UploadedDoc) => void,
    ): Promise<number> => {
      const list = Array.from(files)
      if (!list.length) return 0
      setBusy(true)
      setError(null)
      let acceptedNow = 0
      try {
        for (const file of list) {
          const body = new FormData()
          body.set('file', file)
          const r = await fetch('/api/documents', {
            method: 'POST',
            headers: { 'x-csrf-token': csrf },
            body,
          })
          const payload = await r.json().catch(() => ({}))
          if (r.ok) {
            acceptedNow++
            if (payload.document) onFile?.(payload.document as UploadedDoc)
          } else {
            setError(payload.error ?? 'upload failed')
          }
        }
        return acceptedNow
      } finally {
        setBusy(false)
        setAccepted((prev) => prev + acceptedNow)
      }
    },
    [csrf],
  )

  return { upload, busy, error, accepted }
}
