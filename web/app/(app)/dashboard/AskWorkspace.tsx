'use client'

import { useCallback, useState } from 'react'
import type { OnboardingState } from '@/lib/onboarding'
import type { Dictionary } from '@/lib/i18n'
import { useTourTarget } from '@/lib/tour/targets'
import { Conversations } from './Conversations'
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
  selectedChatId: string | null,
  pending: string | null,
): boolean {
  return (
    !onboarding.steps[2].done &&
    selectedChatId === null &&
    pending === null &&
    (onboarding.workspaceEmpty || suggestions.length > 0)
  )
}

export function AskWorkspace({
  csrf,
  onboarding,
  initialSuggestions,
  dict,
}: {
  csrf: string
  onboarding: OnboardingState | null
  initialSuggestions: string[]
  /** Resolved once, server-side, for the caller's locale. Forwarded in
   * slices to whichever child actually needs copy — GetStarted's empty
   * state, AskChat's just-in-time citation hint — rather than each child
   * re-resolving its own dictionary. */
  dict: Dictionary
}) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  // Bumped whenever the sidebar list needs to refetch out-of-band — right now
  // that's only "a brand-new thread was just created by the first message".
  const [reloadSignal, setReloadSignal] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
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

  const handleFirstMessage = useCallback((newChatId: string) => {
    setSelectedChatId(newChatId)
    setReloadSignal((n) => n + 1)
  }, [])

  const handleSelect = useCallback((id: string | null) => {
    setSelectedChatId(id)
    setMobileOpen(false)
  }, [])

  return (
    <div className="flex h-dvh flex-col max-md:h-[calc(100dvh-3.5rem)]">
      <div className="hidden items-center justify-end border-b border-line px-4 py-2 max-md:flex">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="rounded-md border border-line px-3 py-1 text-body-sm text-ink-soft"
        >
          {mobileOpen ? 'Close' : 'Chats'}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-20 hidden bg-[color-mix(in_srgb,var(--ink)_30%,transparent)] max-md:block"
          />
        )}

        <div
          className={`z-30 h-full shrink-0 border-r border-line bg-paper-sunk max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-72 max-md:transition-transform max-md:duration-200 ${
            mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
          }`}
        >
          <Conversations
            csrf={csrf}
            selectedChatId={selectedChatId}
            onSelectChat={handleSelect}
            reloadSignal={reloadSignal}
          />
        </div>

        <div ref={askPaneRef} className="h-full min-w-0 flex-1">
          {onboarding && showGetStarted(onboarding, initialSuggestions, selectedChatId, pending) ? (
            <GetStarted
              workspaceEmpty={onboarding.workspaceEmpty}
              suggestions={initialSuggestions}
              onPick={(q) => setPending(q)}
              emptyState={dict.emptyStates.askNoDocuments}
            />
          ) : (
            <AskChat
              csrf={csrf}
              chatId={selectedChatId}
              onFirstMessage={handleFirstMessage}
              initialQuestion={pending}
              citationHint={dict.tour.citationHint}
            />
          )}
        </div>
      </div>
    </div>
  )
}
