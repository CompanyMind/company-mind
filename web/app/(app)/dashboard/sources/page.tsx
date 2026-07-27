import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { env } from '@/lib/env'
import { listDocuments } from '@/lib/documents'
import { Sources } from '../Sources'

export const runtime = 'nodejs'

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>
}) {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  const { doc } = await searchParams

  // Deep link from Atlas: send the caller to wherever that document actually lives.
  if (doc && auth) {
    const target = (
      await listDocuments(auth.workspace.id, { userId: auth.user.id, role: auth.role })
    ).find((d) => d.id === doc)
    if (target) redirect(`/dashboard/sources/${target.folderId ?? 'unfiled'}?doc=${doc}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-2">
        <h1 className="font-display text-2xl text-ink">Sources</h1>
        {/* The egress claim is mode-dependent and must stay true in both. This
            line asserted the ON-PREM claim unconditionally, so a hosted
            deployment was telling a regulated buyer its files never leave their
            infrastructure — which is not available when many firms share one
            server. Same two strings the sidebar and Settings use. */}
        <p className="mt-1 text-body-sm text-ink-soft">
          Everything in <strong className="text-ink">{auth?.workspace.name}</strong>’s brain.{' '}
          {env.DEPLOYMENT_MODE === 'onprem'
            ? 'Files never leave your infrastructure.'
            : 'Files never leave this server, and are never used for training.'}
        </p>
      </header>
      <Sources
        csrf={csrf}
        locale={auth?.user.locale ?? 'en'}
        canManage={auth?.role === 'owner'}
      />
    </div>
  )
}
