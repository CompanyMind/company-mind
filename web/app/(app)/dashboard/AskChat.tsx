'use client'

import { useEffect, useRef, useState } from 'react'

type Cite = {
  marker: number
  chunkId: string
  filename: string
  page: number | null
  snippet: string
}
type Msg = { id: string; role: 'user' | 'assistant'; content: string; citations: Cite[] }

// Render answer text with [n] turned into inline citation buttons.
function AnswerBody({ msg, onCite }: { msg: Msg; onCite: (m: number) => void }) {
  const parts = msg.content.split(/(\[\d+\])/g)
  return (
    <p className="text-body leading-[1.7] text-ink">
      {parts.map((p, i) => {
        const m = /^\[(\d+)\]$/.exec(p)
        if (m && msg.citations.some((c) => c.marker === Number(m[1]))) {
          const n = Number(m[1])
          return (
            <button
              key={i}
              onClick={() => onCite(n)}
              className="mx-0.5 inline-flex -translate-y-0.5 items-center rounded-sm bg-[color-mix(in_srgb,var(--brain)_16%,transparent)] px-1 font-mono text-[0.7rem] text-brain-text hover:bg-[color-mix(in_srgb,var(--brain)_28%,transparent)]"
              aria-label={`Source ${n}`}
            >
              {n}
            </button>
          )
        }
        return <span key={i}>{p}</span>
      })}
    </p>
  )
}

export function AskChat({ csrf }: { csrf: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Record<string, number | null>>({})
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/ask')
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setMsgs(d.messages ?? []))
  }, [])
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const question = q.trim()
    if (!question || busy) return
    setQ('')
    setBusy(true)
    setMsgs((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: question, citations: [] }])
    try {
      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ question }),
      })
      const d = await r.json()
      if (r.ok) setMsgs((m) => [...m, d.message])
      else
        setMsgs((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: d.error ?? 'Something went wrong.',
            citations: [],
          },
        ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col px-6 max-md:h-[calc(100dvh-3.5rem)]">
      <header className="py-6">
        <h1 className="font-display text-2xl text-ink">Ask</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Answers come only from your sources — every claim traces back to where it’s from.
        </p>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto pb-4">
        {msgs.length === 0 && (
          <p className="mt-16 text-center text-body text-ink-soft">
            Ask anything about your company’s knowledge.
          </p>
        )}
        {msgs.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-paper-sunk px-4 py-2 text-body text-ink">
                {m.content}
              </p>
            </div>
          ) : (
            <div
              key={m.id}
              className="rounded-lg bg-paper-raised p-4 shadow-artifact motion-safe:animate-fade-in"
            >
              <AnswerBody
                msg={m}
                onCite={(n) => setOpen((o) => ({ ...o, [m.id]: o[m.id] === n ? null : n }))}
              />
              {m.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {m.citations.map((c) => (
                    <span key={c.marker} className="inline-flex items-center">
                      <button
                        onClick={() =>
                          setOpen((o) => ({ ...o, [m.id]: o[m.id] === c.marker ? null : c.marker }))
                        }
                        data-active={open[m.id] === c.marker}
                        className="rounded-l-md border border-line px-2 py-1 font-mono text-[0.7rem] text-ink-soft data-[active=true]:border-brain data-[active=true]:text-brain-text"
                      >
                        [{c.marker}] {c.filename}
                        {c.page ? ` · p.${c.page}` : ''}
                      </button>
                      <a
                        href={`/s/${c.chunkId}`}
                        target="_blank"
                        rel="noopener"
                        title="Open source"
                        className="rounded-r-md border border-l-0 border-line px-1.5 py-1 font-mono text-[0.7rem] text-ink-soft hover:border-brain hover:text-brain-text"
                      >
                        ↗
                      </a>
                    </span>
                  ))}
                </div>
              )}
              {open[m.id] != null &&
                (() => {
                  const c = m.citations.find((x) => x.marker === open[m.id])
                  if (!c) return null
                  return (
                    <figure className="mt-3 rounded-md border-l-2 border-brain bg-paper px-4 py-3">
                      <figcaption className="mb-1 font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-ink-soft">
                        {c.filename}
                        {c.page ? ` · page ${c.page}` : ''}
                      </figcaption>
                      <blockquote className="text-body-sm leading-[1.7] text-ink">
                        {c.snippet}
                      </blockquote>
                    </figure>
                  )
                })()}
            </div>
          ),
        )}
        {busy && (
          <p className="text-body-sm text-query-text motion-safe:animate-pulse">
            Searching your sources…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-0 flex gap-2 bg-paper py-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask your company’s knowledge…"
          className="min-w-0 flex-1 rounded-md border border-line-control bg-paper-raised px-4 py-2.5 text-body text-ink"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="rounded-md bg-ink px-5 py-2.5 text-body text-paper disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  )
}
