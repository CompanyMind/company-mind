# App Ask & Citations + Design Overhaul — Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the core loop — a user asks a question and gets a grounded answer whose every claim links to the exact source passage — and make the authed app a real, polished product (app shell, chat/ask experience, refined Sources), not a placeholder dashboard.

**Architecture:** `web` ask API → private `engine` `/ask`: embed the query → workspace-scoped pgvector ANN → assemble labelled context → LLM answers citing `[n]` → engine resolves markers to chunks and returns `{answer, citations[]}`; empty/weak retrieval returns an honest "insufficient evidence" refusal instead of a fabrication. `web` persists the turn (chats/messages/citations), writes a provenance audit-log row, and renders the answer with **Linked-Evidence** citation chips that reveal the exact source. Answering uses a self-hosted OpenAI-compatible chat endpoint when `MODELS_BASE_URL` is set, and a deterministic **fake** answerer otherwise (so the loop is verifiable now).

**Tech Stack:** (engine) FastAPI, pgvector ANN via psycopg, OpenAI-compatible `/chat/completions` + fake fallback; (web) Next.js route handlers + Drizzle, a redesigned `(app)` shell, a client chat UI in the paper/ink brand.

This is **Plan 3 of 3** — it builds on Plan 1 (auth/foundation) and Plan 2 (upload/ingestion). It produces working, testable software: ask → cited answer, end to end.

## Global Constraints

Inherits Plans 1–2. Emphasized/added:

- **Answers are grounded only in retrieved context.** The system prompt forbids outside knowledge; unresolved `[n]` markers are dropped; zero usable context → a fixed refusal string, never a guess.
- **Every read is `workspace_id`-scoped in the SQL predicate** (retrieval, history, citations).
- **The engine stays private**; `/ask` is `X-Engine-Secret`-guarded like `/ingest`.
- **Provenance:** every ask writes one `query_log` row (workspace, user, question, retrieved chunk ids, model). It is append-only.
- **Self-hosted models:** answering calls `${MODELS_BASE_URL}/chat/completions` (OpenAI-compatible). No `MODELS_BASE_URL` → deterministic fake answerer. No content leaves the deployment on the real path.
- **Design system:** reuse `styles/tokens.css` — never fork the palette. Accent inks are graphics/large-display only; use `-text` variants for accent text (WCAG contrast law in tokens.css). Mono (`--font-mono`) is the telemetry/label/citation voice, never body copy. Visible focus rings and reduced-motion are already global — keep them.
- **Copy voice:** plain, active, sentence case. States (empty/error/insufficient) give direction, not mood.

---

## File Structure

**Engine — created:** `app/ask/__init__.py`, `app/ask/retrieve.py`, `app/ask/answer.py`; tests `test_retrieve.py`, `test_answer.py`. **Modified:** `app/main.py` (mount `/ask`).

**Web — schema:** `lib/db/schema.ts` (+ `chats`, `messages`, `citations`, `queryLog`) + migration.
**Web — created:** `lib/engine.ts` (+ `askEngine`), `lib/chat.ts` (persistence + history queries), `app/api/ask/route.ts`, and the redesigned app UI:
- `app/(app)/layout.tsx` (rewritten — rail shell)
- `app/(app)/_components/Rail.tsx` (sidebar nav + egress chip + workspace/sign-out)
- `app/(app)/dashboard/page.tsx` (rewritten — the Ask page)
- `app/(app)/dashboard/AskChat.tsx` (client chat UI + Linked-Evidence)
- `app/(app)/dashboard/sources/page.tsx` (Sources moved here) + reuse existing `Sources.tsx` (restyled)
- `app/globals.css` (+ a few app-shell component classes)

---

## Task 1: Schema — chats, messages, citations, query_log

**Files:** Modify `web/lib/db/schema.ts`; generate migration.

**Interfaces:** Produces `chats`, `messages`, `citations`, `queryLog` Drizzle tables. Column names below are load-bearing for engine SQL + web queries.

- [ ] **Step 1: Append to `web/lib/db/schema.ts`**

```ts
export const chats = pgTable(
  'chats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('chats_workspace_idx').on(t.workspaceId)],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chatId: uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('messages_chat_idx').on(t.chatId)],
)

export const citations = pgTable('citations', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  chunkId: uuid('chunk_id').notNull().references(() => chunks.id, { onDelete: 'cascade' }),
  marker: integer('marker').notNull(), // the [n]
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  page: integer('page'),
  snippet: text('snippet').notNull(),
})

export const queryLog = pgTable('query_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  retrievedChunkIds: uuid('retrieved_chunk_ids').array(),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

- [ ] **Step 2: Generate + apply + verify**

```bash
cd web && npm run db:generate
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" npm run db:migrate
cd .. && docker compose exec -T db psql -U compbrain -d compbrain -c "\dt" | grep -E "chats|messages|citations|query_log"
```
Expected: all four tables listed.

- [ ] **Step 3: Commit** — `git add web/lib/db/schema.ts web/lib/db/migrations && git commit -m "Schema: chats, messages, citations, query_log (provenance)"`

---

## Task 2: Engine retrieve module (TDD)

**Files:** Create `engine/app/ask/__init__.py`, `engine/app/ask/retrieve.py`; test `engine/tests/test_retrieve.py`.

**Interfaces:**
- Produces `Retrieved` (dataclass: `chunk_id, document_id, filename, page, char_start, char_end, text, score`) and `retrieve(workspace_id: str, query: str, k: int = 8) -> list[Retrieved]`.
- Consumes `get_provider` (embeddings, Plan 2) + `get_conn` (Plan 2).

- [ ] **Step 1: Write failing test** `engine/tests/test_retrieve.py` — seeds two workspaces with one chunk each (using the fake embedder + a raw insert), asserts `retrieve(ws1, "anything")` returns only ws1's chunk and never ws2's.

```python
import os
import uuid
import psycopg
import pytest
from app.ask.retrieve import retrieve
from app.ingest.embed import FakeEmbeddings

DB = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _seed(conn, ws, text):
    doc = uuid.uuid4()
    conn.execute(
        "INSERT INTO workspaces (id, name, slug) VALUES (%s,%s,%s)",
        (ws, f"ws-{ws}", str(ws)),
    )
    conn.execute(
        "INSERT INTO documents (id, workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'f.txt','text/plain',1,'k','indexed')",
        (doc, ws),
    )
    vec = FakeEmbeddings(1024).embed([text])[0]
    lit = "[" + ",".join(str(x) for x in vec) + "]"
    conn.execute(
        "INSERT INTO chunks (document_id, workspace_id, ordinal, text, page, char_start, char_end, token_count, embedding) "
        "VALUES (%s,%s,0,%s,1,0,%s,1,%s::vector)",
        (doc, ws, text, len(text), lit),
    )


def test_retrieval_is_workspace_scoped():
    ws1, ws2 = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed(conn, ws1, "alpha content about pgvector")
            _seed(conn, ws2, "beta content about something else")
    try:
        hits = retrieve(str(ws1), "pgvector", k=5)
        assert len(hits) == 1
        assert hits[0].text == "alpha content about pgvector"
        assert hits[0].filename == "f.txt"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id IN (%s,%s)", (ws1, ws2))
```

- [ ] **Step 2: Run — expect fail (or skip if no DATABASE_URL)**

```bash
cd engine && DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" uv run pytest tests/test_retrieve.py -q
```
Expected: FAIL (module missing). If it *skips*, export DATABASE_URL first — the compose db must be up.

- [ ] **Step 3: Create `engine/app/ask/__init__.py`** (empty) and `engine/app/ask/retrieve.py`

```python
from dataclasses import dataclass

from ..db import get_conn
from ..ingest.embed import get_provider


@dataclass
class Retrieved:
    chunk_id: str
    document_id: str
    filename: str
    page: int | None
    char_start: int | None
    char_end: int | None
    text: str
    score: float


def retrieve(workspace_id: str, query: str, k: int = 8) -> list[Retrieved]:
    qvec = get_provider().embed([query])[0]
    lit = "[" + ",".join(str(x) for x in qvec) + "]"
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT c.id, c.document_id, d.filename, c.page, c.char_start, c.char_end, c.text, "
            "       1 - (c.embedding <=> %s::vector) AS score "
            "FROM chunks c JOIN documents d ON d.id = c.document_id "
            "WHERE c.workspace_id = %s AND c.embedding IS NOT NULL "
            "ORDER BY c.embedding <=> %s::vector "
            "LIMIT %s",
            (lit, workspace_id, lit, k),
        ).fetchall()
    finally:
        conn.close()
    return [
        Retrieved(str(r[0]), str(r[1]), r[2], r[3], r[4], r[5], r[6], float(r[7]))
        for r in rows
    ]
```

- [ ] **Step 4: Run — expect pass.** Same command as Step 2 → PASS.

- [ ] **Step 5: Commit** — `git add engine/app/ask/__init__.py engine/app/ask/retrieve.py engine/tests/test_retrieve.py && git commit -m "Engine retrieve: workspace-scoped pgvector ANN (TDD)"`

---

## Task 3: Engine answer module (TDD, fake LLM fallback)

**Files:** Create `engine/app/ask/answer.py`; test `engine/tests/test_answer.py`.

**Interfaces:**
- Produces `Citation` (dataclass: `marker:int, chunk_id, document_id, filename, page, snippet`), `Answered` (dataclass: `answer:str, citations:list[Citation], insufficient:bool`), and `answer_question(question: str, retrieved: list[Retrieved]) -> Answered`.
- `REFUSAL` constant string. Fake answerer is deterministic; real path calls `${MODELS_BASE_URL}/chat/completions` when set.

- [ ] **Step 1: Write failing test** `engine/tests/test_answer.py`

```python
from app.ask.retrieve import Retrieved
from app.ask.answer import answer_question, REFUSAL


def _r(i, text):
    return Retrieved(f"chunk-{i}", f"doc-{i}", f"f{i}.txt", 1, 0, len(text), text, 0.9)


def test_empty_context_refuses():
    out = answer_question("anything?", [])
    assert out.insufficient is True
    assert out.answer == REFUSAL
    assert out.citations == []


def test_answer_cites_resolvable_markers_only():
    out = answer_question("what is retained?", [_r(1, "Backups are retained 30 days.")])
    assert out.insufficient is False
    # fake answerer references [1]; the citation resolves to chunk-1
    assert any(c.marker == 1 and c.chunk_id == "chunk-1" for c in out.citations)
    # no citation points to a marker that has no context
    assert all(1 <= c.marker <= 1 for c in out.citations)
```

- [ ] **Step 2: Run — expect fail.** `cd engine && uv run pytest tests/test_answer.py -q` → FAIL.

- [ ] **Step 3: Create `engine/app/ask/answer.py`**

```python
import re
from dataclasses import dataclass

import httpx

from ..settings import settings
from .retrieve import Retrieved

REFUSAL = "I couldn't find anything in your sources to answer that."

SYSTEM = (
    "You answer strictly from the provided sources. Cite every claim with [n] "
    "referring to the numbered source it came from. If the sources do not contain "
    "the answer, reply exactly: " + REFUSAL + " Do not use outside knowledge."
)


@dataclass
class Citation:
    marker: int
    chunk_id: str
    document_id: str
    filename: str
    page: int | None
    snippet: str


@dataclass
class Answered:
    answer: str
    citations: list[Citation]
    insufficient: bool


def _context_block(retrieved: list[Retrieved]) -> str:
    return "\n\n".join(f"[{i}] {r.text}" for i, r in enumerate(retrieved, start=1))


def _fake_answer(question: str, retrieved: list[Retrieved]) -> str:
    first = retrieved[0].text.strip()
    snippet = (first[:200] + "…") if len(first) > 200 else first
    out = f"Based on your sources: {snippet} [1]"
    if len(retrieved) > 1:
        out += " There is related detail as well [2]."
    return out


def _llm_answer(question: str, retrieved: list[Retrieved]) -> str:
    r = httpx.post(
        f"{settings.models_base_url.rstrip('/')}/chat/completions",
        json={
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": f"Sources:\n{_context_block(retrieved)}\n\nQuestion: {question}",
                },
            ],
            "temperature": 0,
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def answer_question(question: str, retrieved: list[Retrieved]) -> Answered:
    if not retrieved:
        return Answered(REFUSAL, [], True)

    text = _llm_answer(question, retrieved) if settings.models_base_url else _fake_answer(question, retrieved)

    if text.strip() == REFUSAL:
        return Answered(REFUSAL, [], True)

    # Resolve [n] markers to the numbered context; drop any that don't resolve.
    seen: dict[int, Citation] = {}
    for m in re.findall(r"\[(\d+)\]", text):
        n = int(m)
        if 1 <= n <= len(retrieved) and n not in seen:
            r = retrieved[n - 1]
            snippet = (r.text[:280] + "…") if len(r.text) > 280 else r.text
            seen[n] = Citation(n, r.chunk_id, r.document_id, r.filename, r.page, snippet)
    return Answered(text, list(seen.values()), False)
```

- [ ] **Step 4: Run — expect pass.** → PASS.

- [ ] **Step 5: Commit** — `git add engine/app/ask/answer.py engine/tests/test_answer.py && git commit -m "Engine answer: grounded LLM answer + citation resolution + refusal (TDD)"`

---

## Task 4: Engine /ask endpoint

**Files:** Modify `engine/app/main.py`.

**Interfaces:** `POST /ask` `{workspace_id, question}` (header `X-Engine-Secret`) → `{answer, insufficient, retrieved_chunk_ids:[...], citations:[{marker,chunk_id,document_id,filename,page,snippet}]}`.

- [ ] **Step 1: Add the route to `engine/app/main.py`**

```python
from pydantic import BaseModel
from .ask.retrieve import retrieve
from .ask.answer import answer_question


class AskBody(BaseModel):
    workspace_id: str
    question: str


@app.post("/ask", dependencies=[Depends(require_secret)])
def ask(body: AskBody):
    retrieved = retrieve(body.workspace_id, body.question)
    result = answer_question(body.question, retrieved)
    return {
        "answer": result.answer,
        "insufficient": result.insufficient,
        "retrieved_chunk_ids": [r.chunk_id for r in retrieved],
        "citations": [
            {
                "marker": c.marker,
                "chunk_id": c.chunk_id,
                "document_id": c.document_id,
                "filename": c.filename,
                "page": c.page,
                "snippet": c.snippet,
            }
            for c in result.citations
        ],
    }
```

- [ ] **Step 2: Verify secret guard + full engine suite**

```bash
cd engine && uv run python -c "
from fastapi.testclient import TestClient
from app.main import app
c=TestClient(app)
print('no secret ->', c.post('/ask', json={'workspace_id':'w','question':'q'}).status_code)
"
uv run pytest -q
```
Expected: `no secret -> 401`; all tests pass (retrieve test needs DATABASE_URL exported, else skips).

- [ ] **Step 3: Commit** — `git add engine/app/main.py && git commit -m "Engine /ask: secret-guarded retrieve -> cited answer"`

---

## Task 5: Web ask API — proxy + persistence + provenance

**Files:** Modify `web/lib/engine.ts` (+`askEngine`); create `web/lib/chat.ts`, `web/app/api/ask/route.ts`.

**Interfaces:**
- `askEngine(workspaceId, question)` → the engine `/ask` JSON (typed).
- `chat.ts`: `getOrCreateChat(workspaceId, userId)`, `listMessages(chatId, workspaceId)`, `saveTurn(...)` (persists user + assistant messages + citations), `logQuery(...)`.
- `POST /api/ask` `{question}` (auth + CSRF) → `{answer, insufficient, citations[]}`. `GET /api/ask` → message history for the workspace's chat.

- [ ] **Step 1: Add `askEngine` to `web/lib/engine.ts`**

```ts
export type EngineCitation = {
  marker: number
  chunk_id: string
  document_id: string
  filename: string
  page: number | null
  snippet: string
}
export type EngineAnswer = {
  answer: string
  insufficient: boolean
  retrieved_chunk_ids: string[]
  citations: EngineCitation[]
}

export async function askEngine(workspaceId: string, question: string): Promise<EngineAnswer> {
  const res = await fetch(`${env.ENGINE_BASE_URL}/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    body: JSON.stringify({ workspace_id: workspaceId, question }),
  })
  if (!res.ok) throw new Error(`engine /ask responded ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Create `web/lib/chat.ts`** — history + persistence, all workspace-scoped.

```ts
import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chats, messages, citations, queryLog } from '@/lib/db/schema'
import type { EngineCitation } from '@/lib/engine'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: { marker: number; filename: string; page: number | null; snippet: string }[]
}

export async function getOrCreateChat(workspaceId: string, userId: string): Promise<string> {
  const existing = await db.query.chats.findFirst({ where: eq(chats.workspaceId, workspaceId) })
  if (existing) return existing.id
  const [c] = await db.insert(chats).values({ workspaceId, userId, title: 'Ask' }).returning()
  return c.id
}

export async function listMessages(chatId: string, workspaceId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.chatId, chatId), eq(messages.workspaceId, workspaceId)))
    .orderBy(asc(messages.createdAt))
  const cites = await db.select().from(citations).where(eq(citations.workspaceId, workspaceId))
  return rows.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    citations: cites
      .filter((c) => c.messageId === m.id)
      .sort((a, b) => a.marker - b.marker)
      .map((c) => ({ marker: c.marker, filename: c.filename, page: c.page, snippet: c.snippet })),
  }))
}

export async function saveTurn(opts: {
  chatId: string
  workspaceId: string
  question: string
  answer: string
  engineCitations: EngineCitation[]
}): Promise<ChatMessage> {
  await db.insert(messages).values({
    chatId: opts.chatId,
    workspaceId: opts.workspaceId,
    role: 'user',
    content: opts.question,
  })
  const [assistant] = await db
    .insert(messages)
    .values({ chatId: opts.chatId, workspaceId: opts.workspaceId, role: 'assistant', content: opts.answer })
    .returning()
  if (opts.engineCitations.length) {
    await db.insert(citations).values(
      opts.engineCitations.map((c) => ({
        messageId: assistant.id,
        workspaceId: opts.workspaceId,
        chunkId: c.chunk_id,
        marker: c.marker,
        documentId: c.document_id,
        filename: c.filename,
        page: c.page,
        snippet: c.snippet,
      })),
    )
  }
  return {
    id: assistant.id,
    role: 'assistant',
    content: opts.answer,
    citations: opts.engineCitations
      .slice()
      .sort((a, b) => a.marker - b.marker)
      .map((c) => ({ marker: c.marker, filename: c.filename, page: c.page, snippet: c.snippet })),
  }
}

export async function logQuery(opts: {
  workspaceId: string
  userId: string
  question: string
  retrievedChunkIds: string[]
  model: string
}): Promise<void> {
  await db.insert(queryLog).values({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    question: opts.question,
    retrievedChunkIds: opts.retrievedChunkIds,
    model: opts.model,
  })
}
```

- [ ] **Step 3: Create `web/app/api/ask/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { askEngine } from '@/lib/engine'
import { getOrCreateChat, listMessages, saveTurn, logQuery } from '@/lib/chat'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const chatId = await getOrCreateChat(auth.workspace.id, auth.user.id)
  return NextResponse.json({ messages: await listMessages(chatId, auth.workspace.id) })
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const { question } = (await req.json().catch(() => ({}))) as { question?: string }
  const q = (question ?? '').trim()
  if (!q) return NextResponse.json({ error: 'empty question' }, { status: 400 })

  let result
  try {
    result = await askEngine(auth.workspace.id, q)
  } catch {
    return NextResponse.json({ error: 'the answer engine is unavailable' }, { status: 502 })
  }

  const chatId = await getOrCreateChat(auth.workspace.id, auth.user.id)
  const assistant = await saveTurn({
    chatId,
    workspaceId: auth.workspace.id,
    question: q,
    answer: result.answer,
    engineCitations: result.citations,
  })
  await logQuery({
    workspaceId: auth.workspace.id,
    userId: auth.user.id,
    question: q,
    retrievedChunkIds: result.retrieved_chunk_ids,
    model: process.env.LLM_MODEL || 'fake',
  })
  return NextResponse.json({ message: assistant, insufficient: result.insufficient })
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
cd .. && git add web/lib/engine.ts web/lib/chat.ts web/app/api/ask && git commit -m "Web ask API: engine proxy + persistence + provenance log"
```

---

## Task 6: App shell redesign (the rail)

**Files:** Rewrite `web/app/(app)/layout.tsx`; create `web/app/(app)/_components/Rail.tsx`; add shell classes to `web/app/globals.css`.

**Design intent:** a fixed ~240px left **rail** in `paper-sunk` — an instrument panel. Top: CompBrain wordmark (display). Middle: nav (Ask, Sources) with the active item marked by a teal (`--brain`) spine. Bottom: workspace name (mono), a persistent `EGRESS 0 B` mono chip with a slow teal heartbeat dot, and Sign out. Main area: `paper` field, comfortable padding, content max-width. Collapses to a top bar under `md`.

- [ ] **Step 1: Add shell component classes to `web/app/globals.css`** (inside `@layer components`)

```css
  .rail-link {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    color: var(--ink-soft);
    font-size: 0.9375rem;
    border-left: 2px solid transparent;
  }
  .rail-link:hover { color: var(--ink); background-color: color-mix(in srgb, var(--paper-raised) 60%, transparent); }
  .rail-link[data-active='true'] {
    color: var(--ink);
    border-left-color: var(--brain);
    background-color: color-mix(in srgb, var(--paper-raised) 80%, transparent);
  }
```

- [ ] **Step 2: Create `web/app/(app)/_components/Rail.tsx`** (client — needs `usePathname` for active state)

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Ask' },
  { href: '/dashboard/sources', label: 'Sources' },
]

export function Rail({ workspace, userName }: { workspace: string; userName: string | null }) {
  const path = usePathname()
  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper-sunk px-4 py-5 max-md:h-auto max-md:w-full max-md:flex-row max-md:items-center max-md:justify-between max-md:py-3">
      <div className="max-md:flex max-md:items-center max-md:gap-6">
        <span className="font-display text-lg tracking-tight text-ink">CompBrain</span>
        <nav className="mt-8 flex flex-col gap-1 max-md:mt-0 max-md:flex-row">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              data-active={path === n.href}
              className="rail-link"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto flex flex-col gap-3 max-md:mt-0 max-md:flex-row max-md:items-center">
        <div className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-brain motion-safe:animate-heartbeat" aria-hidden="true" />
          egress 0 B
        </div>
        <div className="text-body-sm text-ink-soft max-md:hidden">{workspace}</div>
        <form action="/logout" method="post">
          <button className="text-body-sm text-ink-soft underline underline-offset-2 hover:text-ink">
            Sign out{userName ? ` · ${userName}` : ''}
          </button>
        </form>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Rewrite `web/app/(app)/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Rail } from './_components/Rail'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  return (
    <div className="flex min-h-dvh max-md:flex-col">
      <Rail workspace={auth.workspace.name} userName={auth.user.name} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Build + commit**

```bash
cd web && npm run build
cd .. && git add "web/app/(app)/layout.tsx" "web/app/(app)/_components/Rail.tsx" web/app/globals.css
git commit -m "App shell: paper-sunk rail with nav, egress telemetry, sign-out"
```

---

## Task 7: The Ask page + Linked-Evidence chat UI (signature)

**Files:** Rewrite `web/app/(app)/dashboard/page.tsx`; create `web/app/(app)/dashboard/AskChat.tsx`.

**Design intent:** the app's hero. A centered conversation column (max ~46rem). User turns: right-aligned, quiet, `paper-sunk` bubble. Assistant turns: a `paper-raised` card; the answer text renders with inline citation chips `[n]` (mono, `--brain-text`) that are buttons; clicking one expands a **source card** beneath the answer showing `filename` (mono) · `page` · the `snippet`. Insufficient answers render in a distinct muted state with a link to Sources. Sticky ask bar at the bottom: a single input ("Ask your company's knowledge…") + send. Empty state: one line of directive copy. Answer appears with a soft fade (motion-safe).

- [ ] **Step 1: Create `web/app/(app)/dashboard/AskChat.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

type Cite = { marker: number; filename: string; page: number | null; snippet: string }
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
          { id: `e-${Date.now()}`, role: 'assistant', content: d.error ?? 'Something went wrong.', citations: [] },
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
            <div key={m.id} className="rounded-lg bg-paper-raised p-4 shadow-artifact motion-safe:animate-fade-in">
              <AnswerBody msg={m} onCite={(n) => setOpen((o) => ({ ...o, [m.id]: o[m.id] === n ? null : n }))} />
              {m.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {m.citations.map((c) => (
                    <button
                      key={c.marker}
                      onClick={() => setOpen((o) => ({ ...o, [m.id]: o[m.id] === c.marker ? null : c.marker }))}
                      data-active={open[m.id] === c.marker}
                      className="rounded-md border border-line px-2 py-1 font-mono text-[0.7rem] text-ink-soft data-[active=true]:border-brain data-[active=true]:text-brain-text"
                    >
                      [{c.marker}] {c.filename}
                      {c.page ? ` · p.${c.page}` : ''}
                    </button>
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
                      <blockquote className="text-body-sm leading-[1.7] text-ink">{c.snippet}</blockquote>
                    </figure>
                  )
                })()}
            </div>
          ),
        )}
        {busy && <p className="text-body-sm text-query-text motion-safe:animate-pulse">Searching your sources…</p>}
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
```

- [ ] **Step 2: Rewrite `web/app/(app)/dashboard/page.tsx`**

```tsx
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { AskChat } from './AskChat'

export const runtime = 'nodejs'

export default async function AskPage() {
  await getCurrentUser()
  const csrf = await issueCsrf()
  return <AskChat csrf={csrf} />
}
```

- [ ] **Step 3: Build + commit**

```bash
cd web && npm run build
cd .. && git add "web/app/(app)/dashboard/page.tsx" "web/app/(app)/dashboard/AskChat.tsx"
git commit -m "Ask page: Linked-Evidence cited chat (the app's signature surface)"
```

---

## Task 8: Move Sources to its own page + restyle

**Files:** Create `web/app/(app)/dashboard/sources/page.tsx`; restyle `web/app/(app)/dashboard/Sources.tsx` (add a corpus header).

**Interfaces:** Sources lives at `/dashboard/sources`; the existing `Sources.tsx` component is reused with a header strip showing counts.

- [ ] **Step 1: Create `web/app/(app)/dashboard/sources/page.tsx`**

```tsx
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { Sources } from '../Sources'

export const runtime = 'nodejs'

export default async function SourcesPage() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header className="mb-2">
        <h1 className="font-display text-2xl text-ink">Sources</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          Everything in <strong className="text-ink">{auth?.workspace.name}</strong>’s brain. Files never leave your
          infrastructure.
        </p>
      </header>
      <Sources csrf={csrf} />
    </div>
  )
}
```

- [ ] **Step 2: Trim `Sources.tsx`** — remove its outer `mt-8` wrapper margin if it double-pads under the new page header; keep the upload control + list. (Minimal: change the root `<section className="mt-8">` to `<section className="mt-6">`.)

- [ ] **Step 3: Build + commit**

```bash
cd web && npm run build
cd .. && git add "web/app/(app)/dashboard/sources" "web/app/(app)/dashboard/Sources.tsx"
git commit -m "Sources: dedicated page under the rail with a corpus header"
```

---

## Task 9: End-to-end verification (Playwright)

**Files:** none.

- [ ] **Step 1: Bring up db + engine (host) + web (host)** with `MODELS_BASE_URL` unset (fake answerer), migrations applied, seeded login (as in Plan 2 Task 10).
- [ ] **Step 2: Verify the loop in a browser:**
  1. Sign in → land on **Ask**; the rail shows nav + `EGRESS 0 B`.
  2. Go to **Sources**, upload `knowledge.txt`, wait for `Indexed`.
  3. Back to **Ask**, ask "What is the backup retention policy?" → an answer renders with a `[1]` chip; clicking `[1]` (or the citation pill) reveals the exact source passage (filename · page · snippet).
  4. Ask something absent ("What is our vacation policy?") on an empty/unrelated corpus → the **insufficient-evidence refusal** renders, no fabricated citation. *(With the fake answerer + a matching doc, retrieval still returns the doc; to see the refusal, ask against an empty workspace or before indexing.)*
- [ ] **Step 3: Assert persistence + provenance in DB:**

```bash
docker compose exec -T db psql -U compbrain -d compbrain -c \
"SELECT role, left(content,50) FROM messages ORDER BY created_at;"
docker compose exec -T db psql -U compbrain -d compbrain -c \
"SELECT count(*) AS citations FROM citations;"
docker compose exec -T db psql -U compbrain -d compbrain -c \
"SELECT question, array_length(retrieved_chunk_ids,1) AS n_retrieved, model FROM query_log;"
```
Expected: user+assistant messages persisted; ≥1 citation; a query_log row with retrieved ids + model.
- [ ] **Step 4: Reload the page** → history rehydrates from `GET /api/ask` (messages + citations survive a refresh).
- [ ] **Step 5:** Stop servers; run full suites (`web: npm run test`, `engine: uv run pytest`). Commit nothing unless a fix was needed.

---

## Self-Review (against spec + roadmap)

**Spec coverage:** §5.3 ask path (embed→ANN→context→answer→resolve) → T2–T4; §6 chats/messages/citations → T1; §7 answer module + citation repair/refusal → T3; §9 CSRF on ask → T5; §10 authed app UI → T6–T8. Roadmap "NOW": cited chat (T2–T7) + provenance log (T1/T5) + honest refusal (T3). ✓
**Placeholder scan:** every step has real code. ✓
**Type consistency:** `EngineCitation`/`Answered`/`Retrieved` field names match across engine→web; `citations.marker`/`filename`/`snippet` identical in schema, engine JSON, chat.ts, and AskChat. ✓
**Design:** all colors/fonts from tokens.css; accent text uses `-text` variants; mono only for labels/citations/telemetry; focus + reduced-motion inherited. ✓
**Known limits (recorded):** one chat per workspace (threads later); reranking still deferred; citations deep-link to the stored snippet, not yet to an inline highlight inside the original file (that arrives with a source viewer); fake answerer is non-semantic — real answers need `MODELS_BASE_URL`.

## Next (not built here)
Telegram ask-bot · self-hosted MCP server + public API · the speech pipeline (on-prem ASR + diarization → cited audio) · connectors (SMB/SharePoint/Exchange) · governance/DLP suite — each reuses this retrieval + answer core.
