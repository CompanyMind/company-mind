'use client'

import { useCallback, useState } from 'react'
import { Conversations } from './Conversations'
import { AskChat } from './AskChat'

export function AskWorkspace({ csrf }: { csrf: string }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  // Bumped whenever the sidebar list needs to refetch out-of-band — right now
  // that's only "a brand-new thread was just created by the first message".
  const [reloadSignal, setReloadSignal] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

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

        <div className="h-full min-w-0 flex-1">
          <AskChat csrf={csrf} chatId={selectedChatId} onFirstMessage={handleFirstMessage} />
        </div>
      </div>
    </div>
  )
}
