'use client'

import { useCallback, useEffect, useState } from 'react'

type Doc = {
  id: string
  filename: string
  status: 'uploaded' | 'parsing' | 'indexed' | 'failed'
  error: string | null
  bytes: number
  groupIds: string[]
  folderId: string | null
}
type Group = { id: string; name: string; isDefault: boolean }
type FolderOption = { id: string; name: string }

const STATUS_LABEL: Record<Doc['status'], string> = {
  uploaded: 'Queued',
  parsing: 'Indexing…',
  indexed: 'Indexed',
  failed: 'Failed',
}

export function DocumentList({
  csrf,
  folder,
  initialDoc,
  canManage,
}: {
  csrf: string
  folder: string
  initialDoc?: string
  /** Owner. Group tagging and moving documents are owner-only at the API, and
   *  /api/groups is owner-only too (it returns every colleague's email), so a
   *  member neither fetches it nor gets controls that would 403. */
  canManage: boolean
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [editing, setEditing] = useState<string | null>(initialDoc ?? null)

  const refresh = useCallback(async () => {
    const dr = await fetch(`/api/documents?folder=${encodeURIComponent(folder)}`)
    if (dr.ok) setDocs((await dr.json()).documents)
    // Members stop here: both of these drive owner-only controls, and /api/groups
    // is owner-gated, so fetching them would only produce a 403 per poll tick.
    if (!canManage) return
    const [gr, fr] = await Promise.all([fetch('/api/groups'), fetch('/api/folders')])
    if (gr.ok) setGroups((await gr.json()).groups)
    if (fr.ok) setFolders((await fr.json()).folders)
  }, [folder, canManage])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 2500)
    return () => clearInterval(t)
  }, [refresh])

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

  async function move(doc: Doc, folderId: string) {
    await fetch(`/api/documents/${doc.id}/folder`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ folderId: folderId === 'unfiled' ? null : folderId }),
    })
    await refresh()
  }

  function visibleLabel(doc: Doc) {
    const names = groups.filter((g) => doc.groupIds.includes(g.id)).map((g) => g.name)
    return names.length ? names.join(', ') : 'No one'
  }

  return (
    <ul className="mt-4 divide-y divide-line rounded-md border border-line">
      {docs.length === 0 && (
        <li className="px-4 py-6 text-body-sm text-ink-soft">This folder is empty.</li>
      )}
      {docs.map((d) => (
        <li key={d.id} id={`doc-${d.id}`} className="px-4 py-3">
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
          {canManage && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-ink-soft">
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.08em]">
              visible to: {visibleLabel(d)}
            </span>
            <button
              onClick={() => setEditing(editing === d.id ? null : d.id)}
              className="underline underline-offset-2 hover:text-ink"
            >
              {editing === d.id ? 'done' : 'edit'}
            </button>
            <label className="ml-auto flex items-center gap-1">
              <span className="sr-only">Move {d.filename} to folder</span>
              <select
                value={d.folderId ?? 'unfiled'}
                onChange={(e) => move(d, e.target.value)}
                className="rounded-md border border-line bg-paper px-2 py-1 text-body-sm text-ink-soft"
              >
                <option value="unfiled">Unfiled</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          )}
          {canManage && editing === d.id && (
            <>
              <p className="mt-2 text-body-sm text-ink-soft">
                Access is set here, not by the folder — moving a document between folders never
                changes who can see it.
              </p>
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
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
