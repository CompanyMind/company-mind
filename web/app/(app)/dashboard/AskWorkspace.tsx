'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n'
import { useTourTarget } from '@/lib/tour/targets'
import { AskChat } from './AskChat'

/**
 * The client shell around the chat pane. It exists for exactly two things the
 * server pages cannot do: hold the router callback that turns the first message
 * of a new conversation into a real URL, and anchor the tour's welcome step.
 *
 * It used to also own chat selection, the chat-list sidebar and the Get Started
 * panel. Selection is the URL's job now, the list moved into the one sidebar,
 * and the empty state lives inside AskChat beside the composer it belongs to.
 */
export function AskWorkspace({
  csrf,
  chatId,
  dict,
  userName,
  canManage,
  workspaceEmpty,
}: {
  csrf: string
  /** The open thread, from the route — `/dashboard/c/[chatId]` — or null on
   *  `/dashboard`, the new-chat surface. */
  chatId: string | null
  /** Resolved once, server-side, for the caller's locale. Forwarded in slices
   *  to whichever child actually needs copy rather than each child re-resolving
   *  its own dictionary. */
  dict: Dictionary
  userName: string | null
  /** Owner. Gates the composer's upload control, and decides which empty-state
   *  copy applies: for a member "empty" means "nothing in your access groups". */
  canManage: boolean
  workspaceEmpty: boolean
}) {
  const router = useRouter()
  // Anchors the tour's welcome step. It wraps whatever the chat pane is showing,
  // so it is a durable anchor even before a user has asked anything.
  const askPaneRef = useTourTarget('ask-pane')

  const handleFirstMessage = useCallback(
    (newChatId: string) => {
      // replace, not push: the empty /dashboard state is not a place worth
      // going back to, and pushing it would make Back re-open a blank composer
      // above a thread that already exists.
      router.replace(`/dashboard/c/${newChatId}`)
      // The sidebar's chat list is a server-rendered sibling in the (app)
      // layout, so it has no idea a thread was just created. This is what puts
      // the new thread in Recents.
      router.refresh()
    },
    [router],
  )

  // h-full, not h-dvh: on a thread route this sits under ThreadHeader inside a
  // flex column that already owns the viewport height, and h-dvh here would
  // push the composer below the fold by exactly the header's height.
  return (
    <div ref={askPaneRef} className="h-full min-w-0">
      <AskChat
        csrf={csrf}
        chatId={chatId}
        onFirstMessage={handleFirstMessage}
        citationHint={dict.tour.citationHint}
        dict={dict.chat}
        userName={userName}
        canManage={canManage}
        workspaceEmpty={workspaceEmpty}
        emptyState={dict.emptyStates.askNoDocuments}
      />
    </div>
  )
}
