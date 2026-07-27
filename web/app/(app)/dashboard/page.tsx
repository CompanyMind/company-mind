import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { listDocuments } from '@/lib/documents'
import { getSuggestions } from '@/lib/engine'
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
        suggestions={[]}
      />
    )
  }

  // listDocuments already applies the access predicate, so for a member this
  // counts what THEY can open — which is why the empty state's member copy says
  // "nothing shared with your groups" rather than "the workspace is empty".
  const docs = await listDocuments(auth.workspace.id, { userId: auth.user.id, role: auth.role })
  const workspaceEmpty = docs.filter((d) => d.status === 'indexed').length === 0

  // The role rides on the session (validateSessionToken already reads the
  // membership row to resolve the workspace), so this no longer re-queries it.
  const suggestions = workspaceEmpty
    ? []
    : await getSuggestions(auth.workspace.id, auth.user.id, auth.role)

  return (
    <AskWorkspace
      csrf={csrf}
      chatId={null}
      dict={dict}
      userName={auth.user.name}
      canManage={auth.role === 'owner'}
      workspaceEmpty={workspaceEmpty}
      suggestions={suggestions}
    />
  )
}
