import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { chatOwned } from '@/lib/chat'
import { getDictionary, isLocale } from '@/lib/i18n'
import { AskWorkspace } from '../../AskWorkspace'

export const runtime = 'nodejs'

export default async function ThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) notFound()
  const { chatId } = await params
  // The id in the URL is NOT an authorization input. chatOwned scopes to
  // (workspaceId, userId) from the session, so someone else's chat id 404s
  // here exactly as it does in /api/chats/[id]. Moving chat selection from
  // component state into the route changed where the id comes FROM; it changed
  // nothing about who is allowed to open it.
  if (!(await chatOwned(chatId, auth.workspace.id, auth.user.id))) notFound()
  const csrf = await issueCsrf()
  const dict = getDictionary(isLocale(auth.user.locale) ? auth.user.locale : 'en')
  return (
    <AskWorkspace
      csrf={csrf}
      chatId={chatId}
      // An open thread is never the first-run empty state — the person
      // demonstrably has a conversation. Passing null skips that branch
      // entirely rather than re-deriving an onboarding snapshot that cannot
      // apply.
      onboarding={null}
      initialSuggestions={[]}
      canManage={auth.role === 'owner'}
      dict={dict}
    />
  )
}
