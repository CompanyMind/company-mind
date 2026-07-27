'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n'
import { CitationHint } from '@/app/(app)/_components/tour/CitationHint'
import { Composer } from './Composer'
import { Message, unresolvedMarkers, type Msg } from './Message'
import { EvidenceRail } from './Evidence'
import { Thinking } from './Thinking'

/**
 * Which greeting applies, from the CLIENT's own clock. The server's timezone is
 * not the reader's, and wishing someone good morning at 9pm is a small,
 * avoidable lie. `null` until the effect runs, which is what the neutral
 * `anonymous` string covers.
 */
function useTimeOfDay(): 'morning' | 'afternoon' | 'evening' | null {
  const [t, setT] = useState<'morning' | 'afternoon' | 'evening' | null>(null)
  useEffect(() => {
    const h = new Date().getHours()
    setT(h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening')
  }, [])
  return t
}

export function AskChat({
  csrf,
  chatId,
  onFirstMessage,
  initialQuestion,
  citationHint,
  dict,
  userName,
  canManage,
  workspaceEmpty,
  emptyState,
}: {
  csrf: string
  chatId: string | null
  onFirstMessage: (chatId: string, title: string | null) => void
  initialQuestion?: string | null
  /** Copy for the just-in-time citation hint (guided-tour spec §4
   * "Deliberately not tour steps") — see CitationHint.tsx. */
  citationHint: Dictionary['tour']['citationHint']
  dict: Dictionary['chat']
  userName: string | null
  /** Owner. Gates the composer's upload control and which empty-state copy
   *  applies — see `emptyState` below. */
  canManage: boolean
  workspaceEmpty: boolean
  emptyState: Dictionary['emptyStates']['askNoDocuments']
}) {
  const router = useRouter()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Record<string, number | null>>({})
  const [suggestions, setSuggestions] = useState<string[]>([])
  // Which answer the evidence rail is showing. Null means "the newest one" —
  // resolved at render, so a fresh answer takes the rail without an effect.
  // Pointing at any marker pins the rail to that answer instead.
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [hoveredMarker, setHoveredMarker] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const timeOfDay = useTimeOfDay()
  // Mirrors `chatId` but updates synchronously the moment a new thread is
  // created, so a rapid second send (before the route change lands) still
  // targets the right chat instead of creating a duplicate thread.
  const activeChatId = useRef<string | null>(chatId)
  // The DOM node of the first citation chip in the first cited answer this
  // pane has rendered — CitationHint's anchor. `null` until such an answer
  // exists.
  const [citationAnchor, setCitationAnchor] = useState<HTMLButtonElement | null>(null)
  // The earliest message with at least one citation — its citations footer is
  // guaranteed to exist whenever `citations.length > 0`, unlike an inline `[n]`
  // marker in the answer text, which depends on the model's own wording.
  const firstCitedMessageId =
    msgs.find((m) => m.role === 'assistant' && m.citations.length > 0)?.id ?? null

  useEffect(() => {
    activeChatId.current = chatId
    setOpen({})
    if (!chatId) {
      setMsgs([])
      return
    }
    let cancelled = false
    fetch(`/api/chats/${chatId}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => {
        if (!cancelled) setMsgs(d.messages ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [chatId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])

  // Starter questions, fetched here instead of awaited in the server component.
  // The engine writes them with the model, one call per folder and in sequence,
  // so leaving them on the render path meant navigating to Ask sat on a blank
  // screen for as long as the model took — for chips that vanish the moment you
  // type. Gated on `chatId === null` rather than "no messages yet": an open
  // thread renders empty for one frame while its history loads, and that frame
  // must not fire a suggestions request the reader will never see.
  useEffect(() => {
    if (chatId !== null || workspaceEmpty) return
    let cancelled = false
    fetch('/api/suggestions')
      .then((r) => (r.ok ? r.json() : { questions: [] }))
      .then((d) => {
        if (!cancelled) setSuggestions(d.questions ?? [])
      })
      // A missing suggestion is not an error worth showing anyone: the empty
      // state without chips is still a working composer.
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [chatId, workspaceEmpty])

  // Takes the question as an argument rather than reading `q`, so it can be
  // driven either by the composer (current input value), by a starter question
  // that never touched the input, or by Retry.
  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || busy) return
      setQ('')
      setBusy(true)
      setMsgs((m) => [
        ...m,
        { id: `u-${Date.now()}`, role: 'user', content: question, citations: [] },
      ])
      try {
        const r = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ question, chatId: activeChatId.current }),
        })
        const d = await r.json()
        if (r.ok) {
          setMsgs((m) => [...m, d.message])
          if (d.chatId && d.chatId !== activeChatId.current) {
            activeChatId.current = d.chatId
            onFirstMessage(d.chatId, d.title ?? null)
          }
        } else {
          setMsgs((m) => [
            ...m,
            {
              id: `e-${Date.now()}`,
              role: 'assistant',
              content: d.error ?? 'Something went wrong.',
              citations: [],
            },
          ])
        }
      } finally {
        setBusy(false)
      }
    },
    [busy, csrf, onFirstMessage],
  )

  // A starter question picked on the empty state: send once. The ref (not
  // state) survives React 19 StrictMode's double-invoke of effects in
  // development, so a second mount pass doesn't fire a second /api/ask call
  // and create a duplicate chat thread.
  const sentInitial = useRef(false)
  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true
      void send(initialQuestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  /** The user message immediately before `msg` — what Retry re-sends. */
  function previousQuestion(index: number): string | null {
    for (let i = index - 1; i >= 0; i--) if (msgs[i].role === 'user') return msgs[i].content
    return null
  }

  // The answer the rail is showing. Falls back to the newest assistant turn, so
  // the rail follows the conversation without anyone having to drive it, and a
  // pin that outlives its message (a cleared thread) degrades to that too.
  const lastAnswer = [...msgs].reverse().find((m) => m.role === 'assistant') ?? null
  const railMsg = (pinnedId && msgs.find((m) => m.id === pinnedId)) || lastAnswer

  const composer = (
    <Composer
      csrf={csrf}
      value={q}
      onChange={setQ}
      onSubmit={() => void send(q)}
      busy={busy}
      canManage={canManage}
      dict={dict}
      autoFocus={msgs.length === 0}
      // A file added here joins the workspace's Sources, so the server-derived
      // state this pane was rendered with (is the workspace empty, what are the
      // starter suggestions) is stale the moment one lands.
      onUploaded={() => router.refresh()}
    />
  )

  // ---- Empty state: greeting, composer, suggestions ----
  if (msgs.length === 0 && !busy) {
    const greeting = timeOfDay
      ? dict.greeting[timeOfDay].replace('{name}', userName ?? '')
      : dict.greeting.anonymous
    return (
      <div className="flex h-full flex-col overflow-y-auto px-6">
        <div className="mx-auto flex w-full max-w-[var(--chat-measure)] flex-1 flex-col justify-center py-16">
          <h1 className="mb-6 text-center font-display text-display-sm text-ink">
            {/* Trailing ", " when the account has no name yet — trim it rather
                than greeting "Good afternoon, ". */}
            {greeting.replace(/,\s*$/, '')}
          </h1>

          {composer}

          {workspaceEmpty ? (
            <div className="mt-6 text-center">
              {/* For a member, "empty" means "nothing in YOUR access groups",
                  not "the workspace is empty" — and the owner copy would be an
                  instruction they have no permission to follow. */}
              <p className="mx-auto max-w-prose text-body text-ink-soft">
                {canManage ? emptyState.body : emptyState.memberBody}
              </p>
              {canManage && (
                <Link
                  href="/dashboard/sources"
                  className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-body-sm text-paper"
                >
                  {emptyState.cta}
                </Link>
              )}
            </div>
          ) : (
            suggestions.length > 0 && (
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => void send(s)}
                      className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-body-sm text-ink-soft hover:border-brain hover:text-ink"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          <p className="mt-8 text-center text-body-sm text-ink-soft">{dict.footer}</p>
        </div>
      </div>
    )
  }

  // ---- Thread ----
  return (
    // The rail is a sibling of the whole conversation column (messages AND
    // composer), not of the message list — it is thread furniture, so it spans
    // the full height and does not scroll away with the transcript.
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="mx-auto flex w-full max-w-[var(--chat-measure)] flex-col gap-7 py-8">
            {msgs.map((m, i) => (
              <Message
                key={m.id}
                msg={m}
                dict={dict}
                openMarker={open[m.id] ?? null}
                onToggleCite={(n) => {
                  setPinnedId(m.id)
                  setOpen((o) => ({ ...o, [m.id]: o[m.id] === n ? null : n }))
                }}
                onToggleAll={() =>
                  setOpen((o) => ({
                    ...o,
                    [m.id]: o[m.id] == null ? (m.citations[0]?.marker ?? null) : null,
                  }))
                }
                onRetry={
                  m.role === 'assistant' && previousQuestion(i)
                    ? () => void send(previousQuestion(i)!)
                    : undefined
                }
                citationAnchorRef={m.id === firstCitedMessageId ? setCitationAnchor : undefined}
                hoveredMarker={railMsg?.id === m.id ? hoveredMarker : null}
                onHoverCite={(n) => {
                  if (m.role !== 'assistant') return
                  setPinnedId(m.id)
                  setHoveredMarker(n)
                }}
              />
            ))}
            {busy && <Thinking dict={dict.thinking} />}
            <div ref={endRef} />
          </div>
        </div>

        <div className="px-6 pb-4">
          <div className="mx-auto w-full max-w-[var(--chat-measure)]">
            {composer}
            <p className="mt-2 text-center text-[0.75rem] text-ink-soft">{dict.footer}</p>
          </div>
        </div>

        <CitationHint anchorEl={citationAnchor} dict={citationHint} />
      </div>

      <EvidenceRail
        citations={railMsg?.citations ?? []}
        openMarker={railMsg ? (open[railMsg.id] ?? null) : null}
        onActivate={(n) =>
          railMsg && setOpen((o) => ({ ...o, [railMsg.id]: o[railMsg.id] === n ? null : n }))
        }
        onHover={setHoveredMarker}
        hasAnswer={!!lastAnswer}
        uncited={!!railMsg && unresolvedMarkers(railMsg).length > 0}
        dict={dict}
      />
    </div>
  )
}
