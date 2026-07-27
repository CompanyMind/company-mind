import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
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

  const { folders } = await listFolders(auth.workspace.id, {
    userId: auth.user.id,
    role: auth.role,
  })
  const folder = folders.find((f) => f.id === folderId)
  if (folderId !== 'unfiled' && !folder) notFound()

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
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
        <h1 className="mt-3 font-display text-2xl text-ink">Unfiled</h1>
      )}
      <DocumentList
        csrf={csrf}
        folder={folderId}
        initialDoc={doc}
        canManage={auth.role === 'owner'}
      />
    </div>
  )
}
