import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { getDictionary, isLocale } from '@/lib/i18n'
import { listFolders } from '@/lib/folders'
import { DocumentList } from '../DocumentList'
import { FolderHeader } from './FolderHeader'

export const runtime = 'nodejs'

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ folderId: string }>
  searchParams: Promise<{ doc?: string }>
}) {
  const auth = await getCurrentUser()
  if (!auth) notFound()
  const { folderId } = await params
  const { doc } = await searchParams
  const csrf = await issueCsrf()
  const dict = getDictionary(auth && isLocale(auth.user.locale) ? auth.user.locale : 'en')

  const { folders } = await listFolders(auth.workspace.id, {
    userId: auth.user.id,
    role: auth.role,
  })
  const folder = folders.find((f) => f.id === folderId)
  if (folderId !== 'unfiled' && !folder) notFound()

  return (
    // A fixed-height column whose LIST scrolls, not the page — the same shape
    // the thread route uses. The whole page used to scroll, so the way back to
    // Sources and the name of the folder you are in both slid off the top the
    // moment a folder held more documents than fit; in a folder of 40 files you
    // could not tell which folder you were looking at without scrolling back up.
    <div className="flex h-dvh flex-col max-md:h-[calc(100dvh-3.5rem)]">
      <header className="shrink-0 border-b border-line px-6 pb-4 pt-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/dashboard/sources"
            className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            ← Sources
          </Link>
          {folder ? (
            <FolderHeader
              id={folder.id}
              name={folder.name}
              csrf={csrf}
              canManage={auth.role === 'owner'}
            />
          ) : (
            <h1 className="mt-3 font-display text-2xl text-ink">{dict.panels.sources.unfiled}</h1>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="mx-auto max-w-3xl">
          <DocumentList
            csrf={csrf}
            folder={folderId}
            initialDoc={doc}
            canManage={auth.role === 'owner'}
            dict={dict}
          />
        </div>
      </div>
    </div>
  )
}
