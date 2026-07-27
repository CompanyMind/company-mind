'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OnboardingState } from '@/lib/onboarding'
import type { Dictionary } from '@/lib/i18n'
import { useTourTarget } from '@/lib/tour/targets'
import { AskChat } from './AskChat'
import { GetStarted } from './GetStarted'

// Whether to show the Get Started empty state instead of the real chat pane.
// Once step 3 (ask) is done, or a chat/starter-question is already active,
// this is always false — the normal chat UI wins permanently. The
// `suggestions` check matters because GetStarted's only way to ask a
// question, once documents exist, is a starter question — and the engine
// only derives those from folders (engine/app/library/suggest.py). A
// workspace with indexed but not-yet-organised documents would otherwise
// render a panel with nothing clickable in it, so fall through to the real
// chat box in that window instead.
function showGetStarted(
  onboarding: OnboardingState,
  suggestions: string[],
  chatId: string | null,
  pending: string | null,
): boolean {
  return (
    !onboarding.steps[2].done &&
    chatId === null &&
    pending === null &&
    (onboarding.workspaceEmpty || suggestions.length > 0)
  )
}

export function AskWorkspace({
  csrf,
  chatId,
  onboarding,
  initialSuggestions,
  dict,
  canManage,
}: {
  csrf: string
  /** The open thread, from the route — `/dashboard/c/[chatId]` — or null on
   *  `/dashboard`, which is the new-chat surface. This used to be component
   *  state with the chat list as a sibling; it lives in the URL now so a
   *  single layout-level sidebar can link to threads, and so a thread
   *  survives a reload and can be shared. */
  chatId: string | null
  onboarding: OnboardingState | null
  initialSuggestions: string[]
  /** Owner. Forwarded to GetStarted, whose empty state otherwise tells a member
   *  to upload documents they have no permission to upload. */
  canManage: boolean
  /** Resolved once, server-side, for the caller's locale. Forwarded in
   * slices to whichever child actually needs copy — GetStarted's empty
   * state, AskChat's just-in-time citation hint — rather than each child
   * re-resolving its own dictionary. */
  dict: Dictionary
}) {
  const router = useRouter()
  // A starter question picked off the Get Started empty state. It is fed into
  // AskChat as `initialQuestion` so a click produces a real send, not just a
  // prefilled input. It also stands in for "the user has asked something
  // this session": the server-derived `onboarding` prop is a snapshot from
  // the last page load and won't flip `steps[2].done` until the next
  // navigation, so without this, picking a suggestion would immediately
  // re-render Get Started instead of the chat thread that's now sending it.
  const [pending, setPending] = useState<string | null>(null)
  // The Ask pane wrapper — anchors the tour's welcome step. It exists
  // whether GetStarted or the real chat is showing inside it, so it's a
  // durable anchor even before a user has asked anything.
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

  return (
    <div ref={askPaneRef} className="flex h-dvh min-w-0 flex-col max-md:h-[calc(100dvh-3.5rem)]">
      {onboarding && showGetStarted(onboarding, initialSuggestions, chatId, pending) ? (
        <GetStarted
          canManage={canManage}
          workspaceEmpty={onboarding.workspaceEmpty}
          suggestions={initialSuggestions}
          onPick={(q) => setPending(q)}
          emptyState={dict.emptyStates.askNoDocuments}
        />
      ) : (
        <AskChat
          csrf={csrf}
          chatId={chatId}
          onFirstMessage={handleFirstMessage}
          initialQuestion={pending}
          citationHint={dict.tour.citationHint}
        />
      )}
    </div>
  )
}
