import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { listDocuments } from '@/lib/documents'
import { getDictionary, isLocale } from '@/lib/i18n'
import { AskWorkspace } from './AskWorkspace'

export const runtime = 'nodejs'

export default async function AskPage() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  // Resolved server-side once and forwarded as plain, serializable slices —
  // same "pass the dictionary in from a server component" pattern index.ts's
  // own doc comment anticipates. Defaults to 'en' both for a signed-out
  // caller (auth is null) and for a locale value the dictionary set doesn't
  // recognise.
  const dict = getDictionary(auth && isLocale(auth.user.locale) ? auth.user.locale : 'en')
  if (!auth) {
    return (
      <AskWorkspace
        csrf={csrf}
        chatId={null}
        dict={dict}
        userName={null}
        canManage={false}
        workspaceEmpty
      />
    )
  }

  // listDocuments already applies the access predicate, so for a member this
  // counts what THEY can open — which is why the empty state's member copy says
  // "nothing shared with your groups" rather than "the workspace is empty".
  // The one thing still on the render path, and it has to be: which empty state
  // applies changes the whole panel, so resolving it in the browser would flash
  // the wrong one. It is a single scoped listing.
  //
  // The starter questions used to be awaited here too — three sequential model
  // calls, which is what made opening Ask from Sources feel stuck. They are now
  // fetched by AskChat from /api/suggestions after the composer is on screen.
  const docs = await listDocuments(auth.workspace.id, { userId: auth.user.id, role: auth.role })
  const workspaceEmpty = docs.filter((d) => d.status === 'indexed').length === 0

  return (
    <AskWorkspace
      csrf={csrf}
      chatId={null}
      dict={dict}
      userName={auth.user.name}
      canManage={auth.role === 'owner'}
      workspaceEmpty={workspaceEmpty}
    />
  )
}
