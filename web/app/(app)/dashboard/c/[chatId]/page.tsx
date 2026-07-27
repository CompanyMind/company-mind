import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { getChat } from '@/lib/chat'
import { getDictionary, isLocale } from '@/lib/i18n'
import { AskWorkspace } from '../../AskWorkspace'
import { ThreadHeader } from '../../ThreadHeader'

export const runtime = 'nodejs'

export default async function ThreadPage({ params }: { params: Promise<{ chatId: string }> }) {
  const auth = await getCurrentUser()
  if (!auth) notFound()
  const { chatId } = await params
  // The id in the URL is NOT an authorization input. getChat scopes to
  // (workspaceId, userId) from the session, so someone else's chat id 404s
  // here exactly as it does in /api/chats/[id]. Moving chat selection from
  // component state into the route changed where the id comes FROM; it changed
  // nothing about who is allowed to open it.
  const chat = await getChat(chatId, auth.workspace.id, auth.user.id)
  if (!chat) notFound()
  const csrf = await issueCsrf()
  const dict = getDictionary(isLocale(auth.user.locale) ? auth.user.locale : 'en')
  return (
    <div className="flex h-dvh flex-col max-md:h-[calc(100dvh-3.5rem)]">
      <ThreadHeader csrf={csrf} dict={dict.thread} chatId={chat.id} title={chat.title} />
      <div className="min-h-0 flex-1">
        <AskWorkspace
          csrf={csrf}
          chatId={chatId}
          dict={dict}
          userName={auth.user.name}
          canManage={auth.role === 'owner'}
          // An open thread renders messages, not the empty state, so this is not
          // reachable — and deriving it would cost a document listing on every
          // thread open for nothing.
          workspaceEmpty={false}
        />
      </div>
    </div>
  )
}
