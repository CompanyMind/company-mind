# Phase 1 — Measure and Stop the Bleeding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "retrieval isn't accurate" into a number, and stop the defects that are silently
destroying data right now — with zero architectural change.

**Architecture:** Three independent strands. (A) **Stop the bleeding** — five verified bugs, each a
self-contained fix with a regression test. (B) **Instrument** — every silent failure becomes a
recorded `degraded[]` flag, and retrieval reports per-arm candidate counts and per-stage timings into
`query_log`. (C) **Measure** — the repo's first CI, a label-stable golden-set format, an eval runner
with paired-delta gating, and an ANN-vs-exact recall probe that settles whether the `ef_search` fix in
Phase 2 is worth doing at all. Nothing here changes the schema's shape or the retrieval algorithm.

**Tech Stack:** Python 3.12 / FastAPI / psycopg3 / pgvector · Next.js 16 / Drizzle / vitest ·
`ranx` (MIT) for IR metrics · GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-25-retrieval-rearchitecture-design.md` §6 Phase 1.

## Global Constraints

- **`EMBED_DIM = 1024` is pinned in two places** — `web/lib/db/schema.ts:19` and
  `engine/app/settings.py:25`. Do not change it in this phase.
- **psycopg3: use `with conn.transaction()`, never `with conn:`** — the connection context manager
  COMMITS AND CLOSES the connection in psycopg3. Insert vectors with an explicit `%s::vector` cast.
- **`next build` must run with no env and no DB** — `web/lib/db/client.ts` (lazy Proxy) and
  `web/lib/env.ts` (getter-based) exist for this. Keep them lazy.
- **`server-only` throws under vitest/tsx** — `web/vitest.config.ts` aliases it to `test/empty.ts`.
  Tests live in `web/lib/**/*.test.ts`; the vitest `include` glob covers nothing else.
- **No outbound network on the ingest or ask paths.** Deterministic fake providers must keep the whole
  pipeline runnable with no GPU and no credentials (`engine/app/settings.py::use_real_models`).
- **Never commit customer documents.** The pilot's real golden set and corpus live outside the repo,
  referenced by env var. Only synthetic fixtures are committed.
- **Brand is CompanyMind**, never "CompBrain" (infra IDs like the Postgres user/db `compbrain` stay).
- **Log every notable change in `CHANGELOG.md`** under `[Unreleased]`, in the same commit as the change.
- Engine commands run from `engine/`; web commands from `web/`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `.github/workflows/ci.yml` | Engine pytest (with a real Postgres) + web vitest/build. The repo's first CI. |
| `.github/workflows/eval.yml` | Retrieval eval on the committed fixture set, with paired-delta gating. |
| `engine/app/ingest/prepare.py` | DB-free parse→chunk→embed stage, so no pooled connection is held across HTTP. |
| `engine/app/ask/telemetry.py` | `RetrievalDebug` — per-arm counts, per-stage timings, `degraded[]`. |
| `engine/app/ask/qtype.py` | Deterministic question-type classifier (lookup/comparison/aggregate/enumerate). |
| `engine/evals/__init__.py` | Package marker. |
| `engine/evals/goldenset.py` | Golden-set record type, JSONL loader, validation. |
| `engine/evals/metrics.py` | recall@k / ndcg@k / doc-recall@k / MRR + cluster-robust paired bootstrap. |
| `engine/evals/run.py` | Eval runner: load set → retrieve → score → compare to baseline → exit code. |
| `engine/evals/probe_ann.py` | ANN-vs-exact recall sweep over `ef_search` × `iterative_scan` × ACL selectivity. |
| `engine/evals/fixtures/corpus/*.txt` | Synthetic EN/RU/UZ corpus, committed, deterministic. |
| `engine/evals/fixtures/golden.jsonl` | Synthetic golden set over that corpus. |
| `engine/evals/baseline.json` | Per-question scores from the last accepted run; the paired-delta reference. |
| `engine/tests/test_citation_survival.py` | DB-level regression test for the re-ingest cascade bug. |
| `engine/tests/test_prepare.py` | Asserts the parse/embed stage touches no connection. |
| `engine/tests/test_qtype.py`, `test_telemetry.py`, `test_goldenset.py`, `test_metrics.py` | Unit tests. |
| `engine/tests/test_indexes.py` | `EXPLAIN` assertions that the new indexes are usable. |
| `web/lib/upload-limits.ts` | Pure size-guard helper, unit-testable without the route. |
| `web/lib/upload-limits.test.ts` | Its test. |

**Modified**

| File | Change |
|---|---|
| `engine/app/ingest/embed.py` | Honour `index`; batch at 32; assert count. |
| `engine/app/ingest/store.py` | Call `prepare_document`; zero chunks → `failed`, not `indexed`. |
| `engine/app/ask/retrieve.py` | Return `(results, RetrievalDebug)`; time each stage. |
| `engine/app/ask/rerank.py` | Record `degraded` instead of silently returning fusion order. |
| `engine/app/ask/service.py` | Persist telemetry + question type into `query_log`. |
| `engine/app/settings.py` | `embed_batch_size`; reject unimplemented `contextual_mode`. |
| `engine/app/graph/store.py` | `AVG(embedding) … GROUP BY` instead of loading every vector into Python. |
| `engine/pyproject.toml` | Dev deps: `ranx`. |
| `web/lib/db/schema.ts` | Citation FKs → `set null` + nullable; new `query_log` columns; new indexes. |
| `web/lib/chat.ts` | `chunkId: string \| null`. |
| `web/app/(app)/dashboard/AskChat.tsx:163` | Only link a citation when it still has a chunk. |
| `web/app/api/documents/route.ts` | Size guard before `req.formData()`. |
| `CHANGELOG.md` | One entry per task. |

**Task order matters:** Task 1 (CI) first — it makes every later test actually run. Tasks 2–7 are
independent bug fixes. Task 8 must land before 9. Tasks 11–13 build on each other.

---

### Task 1: CI — make the ten DB-gated test files actually run

Today `.github` does not exist and all ten DB-touching test files are `skipif(not DATABASE_URL)`, so
`uv run pytest` exits 0 having verified nothing about retrieval — including the permission-filter test.

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a CI job where `DATABASE_URL` is always set, so every later task's DB test runs on every push.

- [ ] **Step 1: Run the DB-gated tests locally to see the true starting state**

```bash
docker compose up -d db
sleep 5
cd web && DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain npm run db:migrate
cd ../engine && DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain uv run pytest -v
```

Expected: the ten previously-skipped files now execute. **If any test fails, that is a finding — record
the failure verbatim in the commit message and fix the code, not the test.** Do not proceed until green.

- [ ] **Step 2: Write the workflow**

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:

jobs:
  engine:
    runs-on: ubuntu-latest
    services:
      db:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: compbrain
          POSTGRES_PASSWORD: compbrain
          POSTGRES_DB: compbrain
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U compbrain -d compbrain"
          --health-interval 5s --health-timeout 3s --health-retries 20
    env:
      DATABASE_URL: postgres://compbrain:compbrain@localhost:5432/compbrain
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
        working-directory: web
      - name: Apply migrations
        run: npm run db:migrate
        working-directory: web
      - uses: astral-sh/setup-uv@v5
        with:
          enable-cache: true
      - name: Engine tests (with a real database)
        run: uv run pytest -v
        working-directory: engine

  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
        working-directory: web
      - run: npm test
        working-directory: web
      # Must succeed with no env and no database — see Global Constraints.
      - run: npm run build
        working-directory: web
```

- [ ] **Step 3: Verify the workflow parses and the engine job would run the DB tests**

```bash
cd engine && uv run pytest -v 2>&1 | grep -c SKIPPED
```
Expected without `DATABASE_URL`: a non-zero skip count (this is the bug CI fixes).
With `DATABASE_URL` exported: `0`.

- [ ] **Step 4: Add the CHANGELOG entry**

Under `## [Unreleased]` → `### Added`:

```markdown
- **The repo's first CI** (`.github/workflows/ci.yml`): the engine job runs against a real
  `pgvector/pgvector:pg16` service with migrations applied, so the ten `skipif(not DATABASE_URL)`
  test files — including the permission-filter test — now actually execute on every push instead of
  silently skipping. The web job runs vitest plus `next build` with no env, guarding the lazy
  DB-client/env design.
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml CHANGELOG.md
git commit -m "ci: run engine tests against a real Postgres

The ten DB-gated test files were skipping everywhere, so retrieval and the
permission filter had never been verified by an automated run."
```

---

### Task 2: Stop re-ingest from destroying the evidence for every past answer

`citations.chunk_id` and `citations.document_id` are `ON DELETE cascade` (migration `0002:44-45`) while
`engine/app/ingest/store.py:52` runs `DELETE FROM chunks WHERE document_id=…` on every re-ingest.
Re-uploading a revised policy deletes the citation rows of every historical answer that cited it.

**Files:**
- Modify: `web/lib/db/schema.ts:162-180`, `web/lib/chat.ts:13,100`, `web/app/(app)/dashboard/AskChat.tsx:7,163`
- Create: `web/lib/db/migrations/<generated>.sql`, `engine/tests/test_citation_survival.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `citations.chunk_id` and `citations.document_id` are nullable and `ON DELETE SET NULL`.
  `ChatMessage.citations[].chunkId` becomes `string | null`.

- [ ] **Step 1: Write the failing test**

Create `engine/tests/test_citation_survival.py`:

```python
import os
import uuid

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_reingest_preserves_citations():
    """Re-ingesting a document must not destroy the audit trail. store.py deletes
    and re-creates every chunk on re-ingest; a citation is evidence for an answer
    that was already given, so it must survive with its snippet intact."""
    ws, user = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO workspaces (id, name, slug) VALUES (%s,'ws',%s)", (ws, str(ws))
            )
            conn.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@example.test"),
            )
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'policy.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            chunk = conn.execute(
                "INSERT INTO chunks (document_id, workspace_id, ordinal, text) "
                "VALUES (%s,%s,0,'retention is 7 years') RETURNING id",
                (doc, ws),
            ).fetchone()[0]
            chat = conn.execute(
                "INSERT INTO chats (workspace_id, user_id) VALUES (%s,%s) RETURNING id", (ws, user)
            ).fetchone()[0]
            msg = conn.execute(
                "INSERT INTO messages (chat_id, workspace_id, role, content) "
                "VALUES (%s,%s,'assistant','Retention is 7 years [1]') RETURNING id",
                (chat, ws),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO citations (message_id, workspace_id, chunk_id, marker, document_id, "
                "filename, page, snippet) VALUES (%s,%s,%s,1,%s,'policy.txt',1,'retention is 7 years')",
                (msg, ws, chunk, doc),
            )

        # Exactly what ingest/store.py does on re-ingest.
        with conn.transaction():
            conn.execute("DELETE FROM chunks WHERE document_id=%s AND workspace_id=%s", (doc, ws))

        row = conn.execute(
            "SELECT chunk_id, snippet, marker FROM citations WHERE message_id=%s", (msg,)
        ).fetchone()

        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
            conn.execute("DELETE FROM users WHERE id=%s", (user,))

    assert row is not None, "the citation was destroyed by re-ingest"
    assert row[0] is None, "chunk_id should be NULL, not dangling"
    assert row[1] == "retention is 7 years", "the quoted evidence must survive"
    assert row[2] == 1
```

- [ ] **Step 2: Run it to verify it fails**

Run: `DATABASE_URL=… uv run pytest tests/test_citation_survival.py -v`
Expected: FAIL — `assert row is not None` fires, because the cascade deleted the row.

- [ ] **Step 3: Change the schema**

In `web/lib/db/schema.ts`, inside `citations`, replace the two FK columns:

```ts
  // A citation is evidence for an answer that was already given. Re-ingesting a
  // document deletes and re-creates its chunks (engine/app/ingest/store.py), so
  // these must NOT cascade — the row survives with a frozen filename/page/snippet
  // and a null chunk reference, which the UI renders as an unlinkable citation.
  chunkId: uuid('chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
```

- [ ] **Step 4: Generate and apply the migration**

```bash
cd web
npm run db:generate
DATABASE_URL=postgres://compbrain:devpass@localhost:5432/compbrain npm run db:migrate
```

Open the generated SQL and confirm it contains `DROP CONSTRAINT`, `ON DELETE set null`, and
`ALTER COLUMN "chunk_id" DROP NOT NULL` (same for `document_id`). If `drizzle-kit` omits the
NOT NULL drop, append it by hand to the generated file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `DATABASE_URL=… uv run pytest tests/test_citation_survival.py -v`
Expected: PASS.

- [ ] **Step 6: Make the consumers null-safe**

`web/lib/chat.ts:13` — in the `ChatMessage` type:

```ts
    chunkId: string | null
```

`web/app/(app)/dashboard/AskChat.tsx:7` — same change in that file's local citation type. Then at
line 163, only render a link when the chunk still exists:

```tsx
                      {c.chunkId ? (
                        <a
                          href={`/s/${c.chunkId}`}
                          className="underline underline-offset-2 hover:text-ink"
                        >
                          [{c.marker}] {c.filename}
                          {c.page ? ` · p.${c.page}` : ''}
                        </a>
                      ) : (
                        <span
                          className="text-ink-soft"
                          title="The source document has been re-ingested; the quoted text is preserved."
                        >
                          [{c.marker}] {c.filename}
                          {c.page ? ` · p.${c.page}` : ''}
                        </span>
                      )}
```

Match the surrounding className and markup exactly — read lines 155–175 before editing.

- [ ] **Step 7: Verify web still typechecks and tests pass**

```bash
cd web && npm test && npm run build
```
Expected: PASS, no type errors on `chunkId`.

- [ ] **Step 8: CHANGELOG + commit**

Under `### Fixed`:

```markdown
- **Re-ingesting a document no longer destroys the evidence for every past answer.**
  `citations.chunk_id` and `citations.document_id` were `ON DELETE cascade` while
  `ingest/store.py` deletes and re-creates every chunk on re-ingest, so re-uploading a revised
  policy — the most routine operation in the product — silently deleted the citation rows of every
  historical answer that cited it, while the `[1]`/`[2]` markers kept rendering in the message text.
  Both FKs are now nullable and `ON DELETE SET NULL`; the frozen `filename`/`page`/`snippet` survive
  and the UI renders such a citation as unlinkable rather than broken.
```

```bash
git add web/lib/db/schema.ts web/lib/db/migrations web/lib/chat.ts "web/app/(app)/dashboard/AskChat.tsx" engine/tests/test_citation_survival.py CHANGELOG.md
git commit -m "fix: stop re-ingest from cascade-deleting historical citations"
```

---

### Task 3: Honour embedding response order and batch at 32

`engine/app/ingest/embed.py:59` returns `[row["embedding"] for row in data]`, assuming the server
returns rows in request order. One reordered batch pairs every chunk with the wrong vector, silently.
There is also no batching: TEI's default `max-client-batch-size` is 32, so any document over roughly
16 pages fails today against a stock self-hosted embedder.

**Files:**
- Modify: `engine/app/ingest/embed.py`, `engine/app/settings.py`, `engine/tests/test_embed.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `settings.embed_batch_size`.
- Produces: `OpenAICompatEmbeddings(base_url, model, dim, api_key="", batch_size=32, post=None)` where
  `post: Callable[[str, dict, dict], dict]` takes `(url, json_body, headers)` and returns the decoded
  response body. `EmbeddingCountMismatch(Exception)` is raised when the server returns the wrong number
  of vectors.

- [ ] **Step 1: Write the failing tests**

Append to `engine/tests/test_embed.py`:

```python
import pytest

from app.ingest.embed import EmbeddingCountMismatch, OpenAICompatEmbeddings


def test_response_order_is_honoured_not_assumed():
    """The OpenAI embeddings schema carries an explicit `index`; a server is free to
    return rows out of order. Trusting positional order silently pairs every chunk
    with the wrong vector."""
    calls = []

    def fake_post(url, body, headers):
        calls.append(body)
        # Deliberately shuffled: index 2, 0, 1.
        return {"data": [
            {"index": 2, "embedding": [2.0]},
            {"index": 0, "embedding": [0.0]},
            {"index": 1, "embedding": [1.0]},
        ]}

    emb = OpenAICompatEmbeddings("http://x/v1", "m", 1, post=fake_post)
    assert emb.embed(["a", "b", "c"]) == [[0.0], [1.0], [2.0]]
    assert len(calls) == 1


def test_inputs_are_batched():
    """TEI's default max-client-batch-size is 32; one request per document fails
    for any document over roughly 16 pages."""
    sizes = []

    def fake_post(url, body, headers):
        n = len(body["input"])
        sizes.append(n)
        return {"data": [{"index": i, "embedding": [float(i)]} for i in range(n)]}

    emb = OpenAICompatEmbeddings("http://x/v1", "m", 1, batch_size=32, post=fake_post)
    out = emb.embed([f"t{i}" for i in range(70)])
    assert sizes == [32, 32, 6]
    assert len(out) == 70


def test_short_response_raises_instead_of_misaligning():
    def fake_post(url, body, headers):
        return {"data": [{"index": 0, "embedding": [0.0]}]}

    emb = OpenAICompatEmbeddings("http://x/v1", "m", 1, post=fake_post)
    with pytest.raises(EmbeddingCountMismatch):
        emb.embed(["a", "b"])
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest tests/test_embed.py -v`
Expected: FAIL — `ImportError: cannot import name 'EmbeddingCountMismatch'`.

- [ ] **Step 3: Implement**

Replace `OpenAICompatEmbeddings` in `engine/app/ingest/embed.py`:

```python
class EmbeddingCountMismatch(Exception):
    """The provider returned a different number of vectors than we sent texts.
    Never recoverable by guessing — misaligned vectors corrupt the index silently."""


class OpenAICompatEmbeddings:
    def __init__(
        self,
        base_url: str,
        model: str,
        dim: int,
        api_key: str = "",
        batch_size: int = 32,
        post=None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dim = dim
        self.api_key = api_key
        self.batch_size = max(1, batch_size)
        self._post = post or self._http_post

    def _http_post(self, url: str, body: dict, headers: dict) -> dict:
        r = httpx.post(url, json=body, headers=headers, timeout=60)
        r.raise_for_status()
        return r.json()

    def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        # `dimensions` pins the output width to EMBED_DIM — OpenAI text-embedding-3-*
        # supports it; self-hosted OpenAI-compatible servers accept or ignore it.
        body = {"model": self.model, "input": batch, "dimensions": self.dim}
        data = self._post(f"{self.base_url}/embeddings", body, headers)["data"]
        if len(data) != len(batch):
            raise EmbeddingCountMismatch(f"sent {len(batch)} texts, got {len(data)} vectors")
        # Order by the response's own `index` — the schema carries it precisely
        # because positional order is not guaranteed. Fall back to position only
        # when a server omits the field entirely.
        indexed = [(row.get("index", i), row["embedding"]) for i, row in enumerate(data)]
        indexed.sort(key=lambda pair: pair[0])
        return [vec for _, vec in indexed]

    def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            out.extend(self._embed_batch(texts[start : start + self.batch_size]))
        if len(out) != len(texts):
            raise EmbeddingCountMismatch(f"sent {len(texts)} texts, got {len(out)} vectors")
        return out
```

Update `get_provider()` to pass the batch size:

```python
def get_provider() -> EmbeddingsProvider:
    if use_real_models():
        return OpenAICompatEmbeddings(
            settings.models_base_url,
            settings.embed_model,
            settings.embed_dim,
            settings.openai_api_key,
            settings.embed_batch_size,
        )
    return FakeEmbeddings(settings.embed_dim)
```

In `engine/app/settings.py`, under `# --- Models ---`:

```python
    # Texts per embeddings request. TEI's default --max-client-batch-size is 32,
    # so one-request-per-document fails for any document over roughly 16 pages.
    embed_batch_size: int = 32
```

- [ ] **Step 4: Run to verify they pass**

Run: `uv run pytest tests/test_embed.py -v`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 5: CHANGELOG + commit**

Under `### Fixed`:

```markdown
- Embedding requests now honour the response's `index` instead of assuming positional order, are
  batched at `EMBED_BATCH_SIZE` (default 32, matching TEI's default `--max-client-batch-size`), and
  raise `EmbeddingCountMismatch` rather than silently misaligning when a provider returns the wrong
  number of vectors. Previously every chunk of a document went out in a single request — failing
  outright for any document over roughly 16 pages against a stock self-hosted embedder — and a
  reordered response would have paired every chunk with the wrong vector with no symptom.
```

```bash
git add engine/app/ingest/embed.py engine/app/settings.py engine/tests/test_embed.py CHANGELOG.md
git commit -m "fix: honour embedding response index and batch requests at 32"
```

---

### Task 4: Stop holding a pooled connection across the embedding call

`engine/app/ingest/store.py:26` opens `with get_conn() as conn:` and keeps it for the whole function,
including the embedding HTTP call. The pool is `max_size=10`, so ten concurrent uploads drain it and
every `/ask`, Telegram poll and Atlas request blocks.

**Files:**
- Create: `engine/app/ingest/prepare.py`, `engine/tests/test_prepare.py`
- Modify: `engine/app/ingest/store.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `extract_text`, `chunk_text`, `contextualize`, `get_provider` (unchanged).
- Produces: `prepare_document(filename: str, mime: str, data: bytes, mode: str) -> Prepared` where
  `Prepared` is a dataclass with fields `parsed: ParsedDoc`, `chunks: list[Chunk]`,
  `embed_inputs: list[str]`, `vectors: list[list[float]]`. **It performs no database access.**

- [ ] **Step 1: Write the failing test**

Create `engine/tests/test_prepare.py`:

```python
import pytest

import app.ingest.prepare as prepare_mod
from app.ingest.prepare import prepare_document


def test_prepare_touches_no_database(monkeypatch):
    """The embedding call can take a minute. Holding one of the pool's ten
    connections across it starves every ask, Telegram poll and Atlas request."""

    def explode(*args, **kwargs):
        raise AssertionError("prepare_document must not open a database connection")

    monkeypatch.setattr(prepare_mod, "get_conn", explode, raising=False)
    # Also guard the module the pool actually lives in.
    import app.db

    monkeypatch.setattr(app.db, "get_conn", explode)

    out = prepare_document("notes.txt", "text/plain", b"alpha beta gamma", "header")
    assert out.parsed.text == "alpha beta gamma"
    assert len(out.chunks) == 1
    assert len(out.vectors) == len(out.chunks)
    assert out.embed_inputs[0].startswith("notes.txt")


def test_prepare_returns_empty_for_blank_document():
    out = prepare_document("blank.txt", "text/plain", b"", "header")
    assert out.chunks == []
    assert out.vectors == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_prepare.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.ingest.prepare'`.

- [ ] **Step 3: Implement `prepare.py`**

```python
from dataclasses import dataclass

from .chunk import Chunk, chunk_text
from .contextualize import contextualize
from .embed import get_provider
from .parse import ParsedDoc, extract_text


@dataclass
class Prepared:
    parsed: ParsedDoc
    chunks: list[Chunk]
    embed_inputs: list[str]
    vectors: list[list[float]]


def prepare_document(filename: str, mime: str, data: bytes, mode: str) -> Prepared:
    """Parse -> chunk -> contextualize -> embed, with NO database access.

    Deliberately DB-free: embedding is a network call that can take a minute, and
    the pool has ten connections. Holding one across it starves every ask, Telegram
    poll and Atlas request. store.py brackets this call with two short transactions
    instead of wrapping it in one long-lived connection."""
    parsed = extract_text(filename, mime, data)
    chunks = chunk_text(parsed.text, parsed.pages)
    # Embed a contextualized representation (filename/page header) while the raw
    # chunk text is stored for citations.
    embed_inputs = [contextualize(c.text, filename, c.page, mode) for c in chunks]
    vectors = get_provider().embed(embed_inputs) if chunks else []
    return Prepared(parsed=parsed, chunks=chunks, embed_inputs=embed_inputs, vectors=vectors)
```

- [ ] **Step 4: Rewrite `process_document` to bracket it**

Replace the body of `engine/app/ingest/store.py::process_document`:

```python
def process_document(
    document_id: str, workspace_id: str, filename: str, mime: str, data: bytes
) -> None:
    # Three phases, each holding a pooled connection only as long as it needs one.
    # The middle phase (parse/chunk/embed) makes a network call and MUST NOT hold a
    # connection — the pool has ten, and ingest would otherwise starve the ask path.
    try:
        with get_conn() as conn:
            with conn.transaction():
                conn.execute(
                    "UPDATE ingestion_jobs SET status='running', started_at=%s "
                    "WHERE document_id=%s AND workspace_id=%s",
                    (_now(), document_id, workspace_id),
                )
                conn.execute(
                    "UPDATE documents SET status='parsing' WHERE id=%s AND workspace_id=%s",
                    (document_id, workspace_id),
                )

        prepared = prepare_document(filename, mime, data, settings.contextual_mode)

        if not prepared.chunks:
            raise NoExtractableText(
                f"{filename}: parsed to 0 chunks — the file has no extractable text layer"
            )

        with get_conn() as conn:
            with conn.transaction():
                # Idempotent: re-ingesting a document replaces its chunks. Citations
                # survive this (ON DELETE SET NULL) — see migration for citations.
                conn.execute(
                    "DELETE FROM chunks WHERE document_id=%s AND workspace_id=%s",
                    (document_id, workspace_id),
                )
                for c, vec in zip(prepared.chunks, prepared.vectors):
                    conn.execute(
                        "INSERT INTO chunks (document_id, workspace_id, ordinal, text, page, "
                        "char_start, char_end, token_count, embedding) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::vector)",
                        (
                            document_id,
                            workspace_id,
                            c.ordinal,
                            c.text,
                            c.page,
                            c.char_start,
                            c.char_end,
                            c.token_count,
                            _vec_literal(vec),
                        ),
                    )
                conn.execute(
                    "UPDATE documents SET status='indexed', error=NULL, extracted_text=%s "
                    "WHERE id=%s AND workspace_id=%s",
                    (prepared.parsed.text, document_id, workspace_id),
                )
                conn.execute(
                    "UPDATE ingestion_jobs SET status='done', finished_at=%s "
                    "WHERE document_id=%s AND workspace_id=%s",
                    (_now(), document_id, workspace_id),
                )
    except Exception as e:  # noqa: BLE001 — record the failure, never crash the worker
        with get_conn() as conn:
            with conn.transaction():
                conn.execute(
                    "UPDATE documents SET status='failed', error=%s WHERE id=%s AND workspace_id=%s",
                    (str(e)[:500], document_id, workspace_id),
                )
                conn.execute(
                    "UPDATE ingestion_jobs SET status='failed', error=%s, finished_at=%s "
                    "WHERE document_id=%s AND workspace_id=%s",
                    (str(e)[:500], _now(), document_id, workspace_id),
                )
```

Add near the top of the file:

```python
from .prepare import prepare_document


class NoExtractableText(Exception):
    """A document produced zero chunks. Previously this was recorded as
    status='indexed', error=NULL — an empty, unsearchable document that looked
    successfully ingested. A scanned PDF hits this path every time."""
```

Remove the now-unused imports (`extract_text`, `chunk_text`, `contextualize`, `get_provider`).

- [ ] **Step 5: Run all engine tests**

Run: `DATABASE_URL=… uv run pytest -v`
Expected: PASS.

- [ ] **Step 6: CHANGELOG + commit**

Under `### Fixed`:

```markdown
- Ingestion no longer holds a pooled database connection across the embedding HTTP call. Parse →
  chunk → contextualize → embed moved into a DB-free `engine/app/ingest/prepare.py::prepare_document`,
  bracketed by two short transactions; with a ten-connection pool, ten concurrent uploads previously
  drained it and blocked every ask, Telegram poll and Atlas request for the duration.
- A document that parses to zero chunks is now recorded as `status='failed'` with an explanatory
  error, instead of `status='indexed'` with `error=NULL` — the state every scanned PDF landed in,
  which looked like a successful ingest of an empty document.
```

```bash
git add engine/app/ingest/prepare.py engine/app/ingest/store.py engine/tests/test_prepare.py CHANGELOG.md
git commit -m "fix: release the pool connection across embedding; fail zero-chunk documents"
```

---

### Task 5: Add the missing indexes

`chunks` has no `(document_id, ordinal)` index, which is why `_expand_neighbors` scans per result, and
why re-ingest's `DELETE` and the document cascade do too. `citations`, `document_groups`,
`group_members` and `query_log` are likewise unindexed on their hot columns.

**Files:**
- Modify: `web/lib/db/schema.ts`
- Create: `web/lib/db/migrations/<generated>.sql`, `engine/tests/test_indexes.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: index `chunks_doc_ordinal_idx` on `chunks(document_id, ordinal)`, plus the five listed below.

- [ ] **Step 1: Write the failing test**

Create `engine/tests/test_indexes.py`:

```python
import json
import os

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")

# (index name, the query it must serve). Planner choice depends on table size, so
# these run with enable_seqscan off: the assertion is that the index EXISTS and is
# APPLICABLE to the query, which is what silently regresses when a WHERE clause
# or an index definition drifts.
CASES = [
    (
        "chunks_doc_ordinal_idx",
        "SELECT text FROM chunks WHERE workspace_id='00000000-0000-0000-0000-000000000000' "
        "AND document_id='00000000-0000-0000-0000-000000000000' AND ordinal BETWEEN 0 AND 2 "
        "ORDER BY ordinal",
    ),
    (
        "citations_chunk_idx",
        "SELECT id FROM citations WHERE chunk_id='00000000-0000-0000-0000-000000000000'",
    ),
    (
        "document_groups_group_idx",
        "SELECT document_id FROM document_groups "
        "WHERE group_id='00000000-0000-0000-0000-000000000000'",
    ),
]


@pytest.mark.parametrize("index_name,query", CASES)
def test_index_exists_and_is_applicable(index_name, query):
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("SET LOCAL enable_seqscan = off")
            plan = conn.execute(f"EXPLAIN (FORMAT JSON) {query}").fetchone()[0]
    assert index_name in json.dumps(plan), f"{index_name} not used by:\n{query}\nplan: {plan}"
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL=… uv run pytest tests/test_indexes.py -v`
Expected: FAIL — none of the three index names appear in the plans.

- [ ] **Step 3: Add the indexes to the schema**

`web/lib/db/schema.ts` — in the `chunks` index array, add (and delete `chunks_workspace_idx`, whose
selectivity is 1.0 on a single-tenant deployment so the planner never chooses it, while it costs every
insert):

```ts
    // Neighbour expansion, re-ingest DELETE, and the documents cascade all filter
    // by document and order by ordinal.
    index('chunks_doc_ordinal_idx').on(t.documentId, t.ordinal),
```

Add index arrays to the tables that have none:

```ts
// citations — third argument to pgTable
  (t) => [
    index('citations_message_idx').on(t.messageId),
    index('citations_chunk_idx').on(t.chunkId),
    index('citations_document_idx').on(t.documentId),
  ],

// documentGroups — add alongside the existing primaryKey entry
    index('document_groups_group_idx').on(t.groupId),

// groupMembers — add alongside the existing group index
    index('group_members_ws_user_idx').on(t.workspaceId, t.userId),

// queryLog
  // A plain btree on (workspace_id, created_at) serves ORDER BY created_at DESC
  // via a backward index scan; no .desc() modifier needed.
  (t) => [index('query_log_ws_created_idx').on(t.workspaceId, t.createdAt)],
```

`citations` and `queryLog` are currently declared without the third `pgTable` argument — add it,
matching the style of `chunks` (arrow function returning an array).

- [ ] **Step 4: Generate, apply, and verify**

```bash
cd web && npm run db:generate && DATABASE_URL=… npm run db:migrate
cd ../engine && DATABASE_URL=… uv run pytest tests/test_indexes.py -v
```
Expected: PASS.

- [ ] **Step 5: Run the full engine suite** (the dropped `chunks_workspace_idx` must not break retrieval)

Run: `DATABASE_URL=… uv run pytest -v`
Expected: PASS.

- [ ] **Step 6: CHANGELOG + commit**

Under `### Fixed`:

```markdown
- Added the indexes retrieval and ingest were missing: `chunks(document_id, ordinal)` (neighbour
  expansion issued one unindexed scan per result, and re-ingest's DELETE and the documents cascade
  scanned too), `citations(message_id|chunk_id|document_id)`, `document_groups(group_id)`,
  `group_members(workspace_id, user_id)` and `query_log(workspace_id, created_at DESC)`. Dropped
  `chunks_workspace_idx`: selectivity 1.0 on a single-tenant deployment, so the planner never chose
  it while every insert paid for it. `engine/tests/test_indexes.py` asserts via `EXPLAIN` that each
  index is applicable to the query it exists for.
```

```bash
git add web/lib/db/schema.ts web/lib/db/migrations engine/tests/test_indexes.py CHANGELOG.md
git commit -m "perf: add the missing chunk/citation/group indexes"
```

---

### Task 6: Compute Atlas document vectors in Postgres

`engine/app/graph/store.py:36-49` loads every chunk embedding in the workspace into Python to compute
per-document means. At 1024 dims that is ~4 KB per chunk over the wire and in RAM. pgvector provides an
`avg(vector)` aggregate.

**Files:**
- Modify: `engine/app/graph/store.py:32-77`
- Modify: `engine/tests/test_graph_store.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `load_docs` unchanged in signature and return type (`list[DocInfo]`).

- [ ] **Step 1: Write the failing test**

Append to `engine/tests/test_graph_store.py` (follow the existing seeding helpers in that file):

```python
def test_mean_vector_matches_numpy_mean():
    """load_docs must compute the same per-document mean as numpy did, now that
    the average is computed in Postgres via pgvector's avg(vector)."""
    import numpy as np

    ws = uuid.uuid4()
    vecs = [FakeEmbeddings(1024).embed([f"chunk {i}"])[0] for i in range(3)]
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            doc = uuid.uuid4()
            conn.execute(
                "INSERT INTO documents (id, workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,%s,'f.txt','text/plain',1,'k','indexed')",
                (doc, ws),
            )
            for i, v in enumerate(vecs):
                lit = "[" + ",".join(str(x) for x in v) + "]"
                conn.execute(
                    "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
                    "VALUES (%s,%s,%s,%s,%s::vector)",
                    (doc, ws, i, f"chunk {i}", lit),
                )
    try:
        with psycopg.connect(DB) as conn:
            register_vector(conn)
            docs = load_docs(conn, str(ws))
        assert len(docs) == 1
        expected = np.mean(np.vstack([np.array(v) for v in vecs]), axis=0)
        assert np.allclose(docs[0].vector, expected, atol=1e-5)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
```

Add whatever imports the file lacks (`uuid`, `psycopg`, `numpy`, `register_vector` from
`pgvector.psycopg`, `FakeEmbeddings`, `load_docs`).

- [ ] **Step 2: Run to verify it passes against the current implementation**

Run: `DATABASE_URL=… uv run pytest tests/test_graph_store.py -v`
Expected: PASS — this test characterises the behaviour we must preserve while changing the mechanism.

- [ ] **Step 3: Replace the Python averaging with SQL**

In `engine/app/graph/store.py::load_docs`, replace the first query and the accumulation loop:

```python
    # Mean vector per doc, computed by pgvector's avg(vector) aggregate rather than
    # streaming every chunk embedding into Python (~4 KB per chunk at 1024 dims).
    rows = conn.execute(
        "SELECT c.document_id, AVG(c.embedding), MIN(d.created_at) "
        "FROM chunks c JOIN documents d ON d.id = c.document_id "
        "WHERE c.workspace_id=%s AND c.embedding IS NOT NULL "
        "GROUP BY c.document_id",
        (ws,),
    ).fetchall()
    means: dict[str, np.ndarray] = {}
    created: dict[str, datetime] = {}
    for did, mean, cat in rows:
        # register_vector() hands back pgvector.Vector wrappers, not numpy arrays.
        vec = mean.to_numpy() if hasattr(mean, "to_numpy") else np.asarray(mean, dtype=float)
        means[str(did)] = vec.astype(float)
        created[str(did)] = cat
```

Then in the final loop replace `for did, vecs in acc.items():` / `mean = np.mean(...)` with:

```python
    for did, mean in means.items():
```

and use `mean` directly in the `DocInfo(...)` construction. Delete the now-unused `acc` dict.

- [ ] **Step 4: Run the graph tests**

Run: `DATABASE_URL=… uv run pytest tests/test_graph_store.py tests/test_graph_service.py tests/test_graph_documents.py -v`
Expected: PASS.

- [ ] **Step 5: CHANGELOG + commit**

Under `### Changed`:

```markdown
- Atlas computes per-document mean vectors with pgvector's `avg(vector)` aggregate in Postgres
  instead of streaming every chunk embedding in the workspace into Python (~4 KB per chunk at 1024
  dims, so a 100k-chunk corpus moved ~400 MB over the wire on every graph build).
```

```bash
git add engine/app/graph/store.py engine/tests/test_graph_store.py CHANGELOG.md
git commit -m "perf: average document vectors in Postgres, not Python"
```

---

### Task 7: Reject oversized uploads before buffering the body

`web/app/api/documents/route.ts:29` calls `await req.formData()` — which buffers the entire body into
memory — and only checks `MAX_BYTES` at line 36.

**Files:**
- Create: `web/lib/upload-limits.ts`, `web/lib/upload-limits.test.ts`
- Modify: `web/app/api/documents/route.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `MAX_UPLOAD_BYTES: number` and `exceedsUploadLimit(contentLength: string | null): boolean`.

- [ ] **Step 1: Write the failing test**

Create `web/lib/upload-limits.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_BYTES, exceedsUploadLimit } from './upload-limits'

describe('exceedsUploadLimit', () => {
  it('rejects a declared length over the limit', () => {
    expect(exceedsUploadLimit(String(MAX_UPLOAD_BYTES + 1))).toBe(true)
  })

  it('accepts a declared length at the limit', () => {
    expect(exceedsUploadLimit(String(MAX_UPLOAD_BYTES))).toBe(false)
  })

  // A missing or unparseable header must not reject: the post-parse check on the
  // real file size is still authoritative, since Content-Length can lie.
  it('accepts a missing header', () => {
    expect(exceedsUploadLimit(null)).toBe(false)
  })

  it('accepts a garbage header', () => {
    expect(exceedsUploadLimit('not-a-number')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/upload-limits.test.ts`
Expected: FAIL — cannot resolve `./upload-limits`.

- [ ] **Step 3: Implement**

Create `web/lib/upload-limits.ts`:

```ts
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Cheap pre-parse guard. `req.formData()` buffers the entire body into memory, so
 * a declared Content-Length over the limit must be rejected BEFORE parsing.
 * Content-Length can lie, so this is a fast path, not the authority — the real
 * `file.size` check after parsing stays.
 */
export function exceedsUploadLimit(contentLength: string | null): boolean {
  if (!contentLength) return false
  const n = Number(contentLength)
  if (!Number.isFinite(n)) return false
  return n > MAX_UPLOAD_BYTES
}
```

In `web/app/api/documents/route.ts`, replace the `MAX_BYTES` constant with an import and add the guard
immediately after the CSRF check, before `req.formData()`:

```ts
import { MAX_UPLOAD_BYTES, exceedsUploadLimit } from '@/lib/upload-limits'

// …inside POST, after the CSRF check:
  if (exceedsUploadLimit(req.headers.get('content-length'))) {
    return NextResponse.json({ error: 'too large' }, { status: 413 })
  }

  const form = await req.formData()
```

and update the post-parse check to use the shared constant:

```ts
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 })
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd web && npm test && npm run build
```
Expected: PASS.

- [ ] **Step 5: CHANGELOG + commit**

Under `### Fixed`:

```markdown
- Oversized uploads are rejected from the declared `Content-Length` before `req.formData()` buffers
  the whole body into memory, and now answer `413` rather than `400`. The authoritative post-parse
  `file.size` check remains, since `Content-Length` can lie.
```

```bash
git add web/lib/upload-limits.ts web/lib/upload-limits.test.ts web/app/api/documents/route.ts CHANGELOG.md
git commit -m "fix: reject oversized uploads before buffering the request body"
```

---

### Task 8: Make silent failures loud

Three paths degrade with no signal: the reranker's `except Exception: pass`
(`ask/rerank.py:74,97`), `CONTEXTUAL_MODE=llm` silently behaving as `header`
(`ingest/contextualize.py`), and out-of-range `[n]` markers dropped without trace
(`ask/answer.py:116`).

**Files:**
- Modify: `engine/app/ask/rerank.py`, `engine/app/settings.py`, `engine/app/ask/answer.py`
- Modify: `engine/tests/test_rerank.py`, `engine/tests/test_answer.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Reranker.rerank(query: str, items: list[RerankItem], top_k: int, degraded: list[str] | None = None) -> list[str]`
    — implementations append a reason string (e.g. `"rerank_http_error:422"`) to `degraded` when they
    fall back to fusion order.
  - `Answered` gains `degraded: list[str]` (default empty).
  - `settings.contextual_mode` raises `ValueError` at import for any value outside `{"off", "header"}`.

- [ ] **Step 1: Write the failing tests**

Append to `engine/tests/test_rerank.py`:

```python
def test_llm_reranker_records_degradation_on_unparseable_response():
    """A reranker that silently returns fusion order is indistinguishable from one
    that never ran. Every fallback must leave a trace."""
    from app.ask.rerank import LLMReranker, RerankItem

    items = [RerankItem("a", "alpha"), RerankItem("b", "beta")]
    degraded: list[str] = []
    r = LLMReranker(call=lambda prompt: "I'm afraid I can't do that.")
    assert r.rerank("q", items, 2, degraded) == ["a", "b"]
    assert any(d.startswith("rerank_unparseable") for d in degraded), degraded


def test_llm_reranker_records_nothing_on_success():
    from app.ask.rerank import LLMReranker, RerankItem

    items = [RerankItem("a", "alpha"), RerankItem("b", "beta")]
    degraded: list[str] = []
    r = LLMReranker(call=lambda prompt: '[{"index": 2, "score": 9}, {"index": 1, "score": 3}]')
    assert r.rerank("q", items, 2, degraded) == ["b", "a"]
    assert degraded == []
```

Append to `engine/tests/test_answer.py`:

```python
def test_out_of_range_marker_is_recorded_not_silently_dropped():
    from app.ask.answer import resolve_citations
    from app.ask.retrieve import Retrieved

    retrieved = [Retrieved("c1", "d1", "f.txt", 1, 0, 5, "alpha", 1.0, "alpha")]
    # The model cited [3] with only one source in context. Today that marker is
    # dropped in silence and the answer renders as if it were fully cited.
    citations, degraded = resolve_citations("Alpha holds [1] and also [3].", retrieved)
    assert [c.marker for c in citations] == [1]
    assert "citation_out_of_range:3" in degraded


def test_uncited_answer_is_flagged():
    from app.ask.answer import resolve_citations

    citations, degraded = resolve_citations("There is no marker here at all.", [])
    assert citations == []
    assert "answer_uncited" in degraded


def test_well_cited_answer_records_nothing():
    from app.ask.answer import resolve_citations
    from app.ask.retrieve import Retrieved

    retrieved = [Retrieved("c1", "d1", "f.txt", 1, 0, 5, "alpha", 1.0, "alpha")]
    citations, degraded = resolve_citations("Alpha holds [1].", retrieved)
    assert [c.marker for c in citations] == [1]
    assert degraded == []
```

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest tests/test_rerank.py tests/test_answer.py -v`
Expected: FAIL — `rerank()` takes 3 positional args; `resolve_citations` does not exist.

- [ ] **Step 3: Implement — rerank**

In `engine/app/ask/rerank.py`, add a helper and thread `degraded` through all four implementations:

```python
def _note(degraded: list[str] | None, reason: str) -> None:
    if degraded is not None:
        degraded.append(reason)
```

`Reranker` protocol:

```python
class Reranker(Protocol):
    def rerank(
        self, query: str, items: list[RerankItem], top_k: int, degraded: list[str] | None = None
    ) -> list[str]: ...
```

`FakeReranker.rerank` — same signature, no note (identity is its contract, not a failure).

`LLMReranker.rerank` — replace the bare `except Exception: pass`:

```python
    def rerank(
        self, query: str, items: list[RerankItem], top_k: int, degraded: list[str] | None = None
    ) -> list[str]:
        cands = "\n".join(f"[{i}] {it.text}" for i, it in enumerate(items, start=1))
        try:
            raw = self._call(_RERANK_PROMPT.format(q=query, cands=cands))
            m = re.search(r"\[.*\]", raw, re.DOTALL)
            parsed = json.loads(m.group(0) if m else raw)
            order: list[str] = []
            for row in parsed:
                idx = int(row["index"]) - 1
                if 0 <= idx < len(items) and items[idx].chunk_id not in order:
                    order.append(items[idx].chunk_id)
            if order:
                if len(order) < min(top_k, len(items)):
                    _note(degraded, f"rerank_short_response:{len(order)}/{min(top_k, len(items))}")
                return order[:top_k]
            _note(degraded, "rerank_unparseable:empty_order")
        except Exception as e:  # noqa: BLE001 — never let reranking break the answer
            _note(degraded, f"rerank_unparseable:{type(e).__name__}")
        return [it.chunk_id for it in items[:top_k]]
```

`CrossEncoderReranker.rerank` — same treatment:

```python
        except httpx.HTTPStatusError as e:
            _note(degraded, f"rerank_http_error:{e.response.status_code}")
        except Exception as e:  # noqa: BLE001
            _note(degraded, f"rerank_error:{type(e).__name__}")
        return [it.chunk_id for it in items[:top_k]]
```

- [ ] **Step 4: Implement — settings validation**

In `engine/app/settings.py`, after the `Settings` class:

```python
_IMPLEMENTED_CONTEXTUAL_MODES = {"off", "header"}

if settings.contextual_mode not in _IMPLEMENTED_CONTEXTUAL_MODES:
    raise ValueError(
        f"CONTEXTUAL_MODE={settings.contextual_mode!r} is not implemented. "
        f"Supported: {sorted(_IMPLEMENTED_CONTEXTUAL_MODES)}. "
        "'llm' (Summary-Augmented Chunking) arrives in Phase 4 — until then it "
        "silently behaved as 'header', which is why this now fails loudly."
    )
```

Update the field's comment to `# off | header  ('llm' lands in Phase 4)`.

- [ ] **Step 5: Implement — answer citation resolution**

In `engine/app/ask/answer.py`, extract the marker loop into a named function and record degradation:

```python
def resolve_citations(text: str, retrieved: list[Retrieved]) -> tuple[list[Citation], list[str]]:
    """Resolve [n] markers to the numbered context. Unresolvable markers and
    entirely-uncited answers are recorded rather than silently dropped — an
    answer with no working citation is exactly the failure this product exists
    to prevent, and it used to look identical to a well-cited one."""
    degraded: list[str] = []
    seen: dict[int, Citation] = {}
    markers = re.findall(r"\[(\d+)\]", text)
    for m in markers:
        n = int(m)
        if not (1 <= n <= len(retrieved)):
            degraded.append(f"citation_out_of_range:{n}")
            continue
        if n in seen:
            continue
        r = retrieved[n - 1]
        snippet = (r.text[:280] + "…") if len(r.text) > 280 else r.text
        seen[n] = Citation(n, r.chunk_id, r.document_id, r.filename, r.page, snippet)
    if not seen:
        degraded.append("answer_uncited")
    return list(seen.values()), degraded
```

Add `degraded: list[str]` to `Answered` (with `field(default_factory=list)`), and rewrite the tail of
`answer_question` to use it:

```python
    citations, degraded = resolve_citations(text, retrieved)
    return Answered(text, citations, False, degraded)
```

Note the refusal branches return `Answered(REFUSAL, [], True, [])` — a deliberate refusal is not a
degradation.

- [ ] **Step 6: Update the one caller of `rerank`**

`engine/app/ask/retrieve.py:127` — leave the call as-is for now (it passes three arguments and
`degraded` defaults to `None`); Task 9 threads the list through.

- [ ] **Step 7: Run the tests**

Run: `DATABASE_URL=… uv run pytest -v`
Expected: PASS.

- [ ] **Step 8: CHANGELOG + commit**

Under `### Changed`:

```markdown
- **Silent failures are now recorded.** The reranker's bare `except Exception: pass` (which made a
  reranker that never ran indistinguishable from one that worked) now appends a reason —
  `rerank_http_error:422`, `rerank_unparseable:…`, `rerank_short_response:…` — to a `degraded` list;
  `[n]` markers that don't resolve are recorded as `citation_out_of_range`, and an answer with no
  working citation as `answer_uncited`. `CONTEXTUAL_MODE=llm`, documented in settings but never
  implemented (it silently behaved as `header`), now fails fast at startup with a message pointing
  at the phase that implements it.
```

```bash
git add engine/app/ask/rerank.py engine/app/ask/answer.py engine/app/settings.py engine/tests CHANGELOG.md
git commit -m "feat: record every silent degradation instead of swallowing it"
```

---

### Task 9: Retrieval telemetry into `query_log`

Nothing currently records which arm produced candidates, whether reranking ran, or where the time went.

**Files:**
- Create: `engine/app/ask/telemetry.py`, `engine/tests/test_telemetry.py`
- Modify: `engine/app/ask/retrieve.py`, `engine/app/ask/service.py`, `engine/tests/test_retrieve.py`,
  `engine/tests/test_ask_service.py`, `web/lib/db/schema.ts`
- Create: `web/lib/db/migrations/<generated>.sql`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `Answered.degraded` (Task 8).
- Produces:
  - `RetrievalDebug` dataclass: `dense_n: int`, `lexical_n: int`, `fused_n: int`, `rerank_in_n: int`,
    `final_n: int`, `rerank_applied: bool`, `degraded: list[str]`, `timings_ms: dict[str, float]`.
  - `retrieve(...) -> tuple[list[Retrieved], RetrievalDebug]` — **signature change, all callers update.**
  - `query_log` columns: `degraded text[]`, `timings_ms jsonb`, `candidate_counts jsonb`,
    `rerank_applied boolean`.

- [ ] **Step 1: Write the failing test**

Create `engine/tests/test_telemetry.py`:

```python
from app.ask.telemetry import RetrievalDebug, stage


def test_stage_records_elapsed_time():
    dbg = RetrievalDebug()
    with stage(dbg, "dense"):
        pass
    assert "dense" in dbg.timings_ms
    assert dbg.timings_ms["dense"] >= 0.0


def test_as_dict_is_json_safe():
    dbg = RetrievalDebug(dense_n=40, lexical_n=0, fused_n=40, rerank_in_n=20, final_n=8)
    dbg.degraded.append("rerank_http_error:422")
    d = dbg.as_dict()
    assert d["candidate_counts"] == {
        "dense": 40, "lexical": 0, "fused": 40, "rerank_in": 20, "final": 8
    }
    assert d["degraded"] == ["rerank_http_error:422"]
    assert d["rerank_applied"] is False


def test_empty_lexical_arm_is_itself_a_degradation():
    """A zero-row lexical arm means hybrid retrieval silently became dense-only —
    the single most likely cause of the accuracy complaint."""
    dbg = RetrievalDebug(dense_n=40, lexical_n=0)
    dbg.finalize()
    assert "lexical_arm_empty" in dbg.degraded
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_telemetry.py -v`
Expected: FAIL — `No module named 'app.ask.telemetry'`.

- [ ] **Step 3: Implement `telemetry.py`**

```python
import time
from contextlib import contextmanager
from dataclasses import dataclass, field


@dataclass
class RetrievalDebug:
    """Per-query retrieval telemetry. Exists so that a degraded pipeline is
    visible in the audit log instead of looking identical to a healthy one."""

    dense_n: int = 0
    lexical_n: int = 0
    fused_n: int = 0
    rerank_in_n: int = 0
    final_n: int = 0
    # Which reranker actually ran. Without this, `rerank_applied: true` from the
    # identity FakeReranker reads exactly like a real cross-encoder pass.
    reranker: str = ""
    rerank_applied: bool = False
    degraded: list[str] = field(default_factory=list)
    timings_ms: dict[str, float] = field(default_factory=dict)

    def finalize(self) -> None:
        # plainto_tsquery ANDs every term, so a long natural-language question
        # routinely matches nothing and "hybrid" retrieval collapses to dense-only.
        # Recording it is how we measure how often that actually happens.
        if self.lexical_n == 0:
            self.degraded.append("lexical_arm_empty")
        if self.dense_n == 0:
            self.degraded.append("dense_arm_empty")

    def as_dict(self) -> dict:
        return {
            "candidate_counts": {
                "dense": self.dense_n,
                "lexical": self.lexical_n,
                "fused": self.fused_n,
                "rerank_in": self.rerank_in_n,
                "final": self.final_n,
            },
            "reranker": self.reranker,
            "rerank_applied": self.rerank_applied,
            "degraded": list(self.degraded),
            "timings_ms": {k: round(v, 2) for k, v in self.timings_ms.items()},
        }


@contextmanager
def stage(dbg: RetrievalDebug, name: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        dbg.timings_ms[name] = (time.perf_counter() - start) * 1000.0
```

- [ ] **Step 4: Thread it through `retrieve`**

Rewrite `engine/app/ask/retrieve.py::retrieve` to build and return a `RetrievalDebug`:

```python
def retrieve(
    workspace_id: str,
    query: str,
    k: int | None = None,
    group_ids: list[str] | None = None,
    all_access: bool = False,
) -> tuple[list[Retrieved], RetrievalDebug]:
    """Hybrid retrieval: dense (pgvector) + lexical (Postgres full-text), fused
    with RRF, per-document capped, reranked, then neighbor-expanded. One
    permission predicate serves both retrievers. Returns the results and a
    RetrievalDebug describing how the pipeline actually behaved."""
    final_k = k or settings.final_k
    gids = group_ids or []
    dbg = RetrievalDebug()

    with stage(dbg, "embed_query"):
        qvec = get_provider().embed([contextualize_query(query)])[0]
    qlit = "[" + ",".join(str(x) for x in qvec) + "]"

    with get_conn() as conn:
        with stage(dbg, "dense"):
            dense = _dense_ids(conn, workspace_id, qlit, all_access, gids, settings.retrieval_n_vec)
        with stage(dbg, "lexical"):
            lexical = _lexical_ids(
                conn, workspace_id, query, all_access, gids, settings.retrieval_n_lex
            )
        dbg.dense_n, dbg.lexical_n = len(dense), len(lexical)

        fused = [cid for cid, _ in rrf([dense, lexical], k=settings.rrf_k)]
        dbg.fused_n = len(fused)
        if not fused:
            dbg.finalize()
            return [], dbg

        meta = _fetch_meta(conn, workspace_id, fused)
        ordered = [c for c in fused if c in meta]
        chunk_to_doc = {c: meta[c]["document_id"] for c in ordered}
        capped = cap_by_document(ordered, chunk_to_doc, settings.doc_cap)[: settings.rerank_in]
        dbg.rerank_in_n = len(capped)

        reranker = get_reranker()
        dbg.reranker = type(reranker).__name__
        with stage(dbg, "rerank"):
            before = len(dbg.degraded)
            ranked_ids = reranker.rerank(
                query, [RerankItem(c, meta[c]["text"]) for c in capped], final_k, dbg.degraded
            )
            dbg.rerank_applied = len(dbg.degraded) == before

        results = [_to_retrieved(c, meta[c]) for c in ranked_ids if c in meta]
        with stage(dbg, "expand"):
            _expand_neighbors(conn, workspace_id, results, meta)

    dbg.final_n = len(results)
    dbg.finalize()
    return results, dbg
```

Add the imports: `from .telemetry import RetrievalDebug, stage`.

- [ ] **Step 5: Update callers and tests**

`engine/app/ask/service.py` — `retrieved, dbg = retrieve(...)`, and extend the `query_log` insert:

```python
    retrieved, dbg = retrieve(workspace_id, question, group_ids=group_ids, all_access=all_access)
    result = answer_question(question, retrieved)
    dbg.degraded.extend(result.degraded)
    chunk_ids = [r.chunk_id for r in retrieved]
    telemetry = dbg.as_dict()
    with get_conn() as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO query_log (workspace_id, user_id, telegram_link_id, question, "
                "retrieved_chunk_ids, model, degraded, timings_ms, candidate_counts, rerank_applied) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    workspace_id, user_id, telegram_link_id, log_question or question,
                    chunk_ids, _model_name(),
                    telemetry["degraded"],
                    json.dumps(telemetry["timings_ms"]),
                    json.dumps(telemetry["candidate_counts"]),
                    telemetry["rerank_applied"],
                ),
            )
```

Add `import json` at the top of `service.py`.

Surface the same telemetry on the API response, so a degraded answer is visible to the caller and not
only in the audit table. In `engine/app/ask/service.py`, add `debug: dict` to `AskResult` and pass
`telemetry`; in `engine/app/main.py::ask`, add `"debug": result.debug` to the returned dict.

In `engine/tests/test_retrieve.py`, unpack the tuple in all three tests — e.g.
`hits, dbg = retrieve(str(ws1), "pgvector", k=5, all_access=True)` — and add one assertion to
`test_lexical_retrieves_exact_token_without_semantic_overlap`:

```python
        assert dbg.lexical_n > 0, "the lexical arm must fire for an exact-token query"
```

- [ ] **Step 6: Add the `query_log` columns**

In `web/lib/db/schema.ts`, inside `queryLog`:

```ts
  // Retrieval telemetry — how the pipeline actually behaved for this query.
  degraded: text('degraded').array(),
  timingsMs: jsonb('timings_ms'),
  candidateCounts: jsonb('candidate_counts'),
  rerankApplied: boolean('rerank_applied'),
  questionType: text('question_type'),
```

Then:

```bash
cd web && npm run db:generate && DATABASE_URL=… npm run db:migrate
```

- [ ] **Step 7: Run everything**

Run: `DATABASE_URL=… uv run pytest -v` and `cd web && npm test && npm run build`
Expected: PASS.

- [ ] **Step 8: CHANGELOG + commit**

Under `### Added`:

```markdown
- **Retrieval telemetry.** `engine/app/ask/telemetry.py::RetrievalDebug` records per-arm candidate
  counts (dense / lexical / fused / rerank-in / final), per-stage latency, whether reranking actually
  applied, and a `degraded[]` list; `retrieve()` now returns `(results, debug)` and `answer_query`
  persists all of it to new `query_log` columns (`degraded`, `timings_ms`, `candidate_counts`,
  `rerank_applied`, `question_type`). A zero-row lexical arm — the expected symptom of
  `plainto_tsquery` ANDing every term — is itself recorded as `lexical_arm_empty`, which is how the
  Phase 1 attribution table gets its numbers.
```

```bash
git add engine/app/ask engine/tests web/lib/db CHANGELOG.md
git commit -m "feat: record retrieval telemetry to query_log"
```

---

### Task 10: Deterministic question-type classifier

The aggregation lane (spec §6 D3) is gated on measuring what share of real traffic is aggregate or
enumerative. That needs a label on every logged query, and it must be deterministic — an LLM call in
the ask path for a governance statistic is not acceptable.

**Files:**
- Create: `engine/app/ask/qtype.py`, `engine/tests/test_qtype.py`
- Modify: `engine/app/ask/service.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `classify_question(text: str) -> str` returning one of
  `"aggregate" | "enumerate" | "comparison" | "lookup"`.

- [ ] **Step 1: Write the failing test**

Create `engine/tests/test_qtype.py`:

```python
import pytest

from app.ask.qtype import classify_question


@pytest.mark.parametrize(
    "q,expected",
    [
        ("How many contracts expire in Q3?", "aggregate"),
        ("Сколько договоров истекает в третьем квартале?", "aggregate"),
        ("What is the total headcount in Finance?", "aggregate"),
        ("List every policy that mentions data retention", "enumerate"),
        ("Перечислите все документы о выплатах", "enumerate"),
        ("Compare the 2025 and 2026 travel policies", "comparison"),
        ("В чём разница между версиями политики?", "comparison"),
        ("What is the data retention period?", "lookup"),
        ("Каков срок хранения данных?", "lookup"),
    ],
)
def test_classify(q, expected):
    assert classify_question(q) == expected


def test_empty_question_is_lookup():
    assert classify_question("") == "lookup"
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_qtype.py -v`
Expected: FAIL — `No module named 'app.ask.qtype'`.

- [ ] **Step 3: Implement**

```python
import re

# Deterministic on purpose: this label drives a governance statistic (what share of
# real traffic needs computation rather than passage retrieval), and an LLM call on
# the ask path for a statistic is neither auditable nor affordable. Rules are
# checked most-specific first. Multilingual because the pilot corpus is RU/UZ/EN.

_AGGREGATE = re.compile(
    r"\b(how many|how much|count|total|sum|average|number of)\b"
    r"|\b(сколько|количество|общая сумма|в среднем|итого)\b"
    r"|\b(nechta|qancha|jami|o'rtacha)\b",
    re.IGNORECASE,
)
_ENUMERATE = re.compile(
    r"\b(list all|list every|list the|show all|which documents|all documents|every)\b"
    r"|\b(перечисл\w*|список|все документы|какие документы)\b"
    r"|\b(ro'yxat|barcha hujjatlar|hammasi)\b",
    re.IGNORECASE,
)
_COMPARISON = re.compile(
    r"\b(compare|difference between|versus|vs\.?|changed between|what changed)\b"
    r"|\b(сравн\w*|разница между|отличие|чем отличается|что изменилось)\b"
    r"|\b(taqqosla\w*|farqi|nima o'zgardi)\b",
    re.IGNORECASE,
)


def classify_question(text: str) -> str:
    """One of: aggregate | enumerate | comparison | lookup."""
    q = (text or "").strip()
    if not q:
        return "lookup"
    if _AGGREGATE.search(q):
        return "aggregate"
    if _ENUMERATE.search(q):
        return "enumerate"
    if _COMPARISON.search(q):
        return "comparison"
    return "lookup"
```

- [ ] **Step 4: Wire it into the audit log**

In `engine/app/ask/service.py`, import it and add `classify_question(question)` as the
`question_type` value in the `query_log` insert (append the column and parameter added in Task 9).

- [ ] **Step 5: Run the tests**

Run: `DATABASE_URL=… uv run pytest tests/test_qtype.py tests/test_ask_service.py -v`
Expected: PASS.

- [ ] **Step 6: CHANGELOG + commit**

Under `### Added`:

```markdown
- Deterministic question-type classification (`aggregate` / `enumerate` / `comparison` / `lookup`,
  EN + RU + UZ keyword rules) recorded on every logged query. This is the measurement that gates
  whether the structured-aggregation lane gets built at all — the spec requires the aggregate share
  of real traffic to exceed ~15% first.
```

```bash
git add engine/app/ask/qtype.py engine/app/ask/service.py engine/tests/test_qtype.py CHANGELOG.md
git commit -m "feat: classify question type on every logged query"
```

---

### Task 11: ANN-vs-exact recall probe

Spec §7.2: the `ef_search` / `iterative_scan` fix in Phase 2 "could be everything or nothing", and must
be measured before it is done. This probe answers it, and needs no labels at all.

**Files:**
- Create: `engine/evals/__init__.py`, `engine/evals/probe_ann.py`, `engine/tests/test_probe_ann.py`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `app.db.get_conn`, `app.ingest.embed.get_provider`.
- Produces: `probe(workspace_id: str, queries: list[str], selectivities: list[float],
  ef_values: list[int], iterative_modes: list[str], limit: int = 40) -> list[ProbeRow]` where
  `ProbeRow` is a dataclass with `selectivity, ef_search, iterative_scan, recall, ann_ms, exact_ms`.

- [ ] **Step 1: Write the failing test**

Create `engine/tests/test_probe_ann.py`:

```python
import os
import uuid

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_probe_reports_perfect_recall_when_nothing_is_filtered():
    """Sanity check on the instrument itself: with 100% of the corpus visible and a
    large ef_search, ANN must agree with exact search. If this fails, the probe is
    wrong, not the database."""
    from evals.probe_ann import probe

    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'p',%s)", (ws, str(ws)))
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'f.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            from app.ingest.embed import FakeEmbeddings

            emb = FakeEmbeddings(1024)
            for i in range(200):
                lit = "[" + ",".join(str(x) for x in emb.embed([f"doc {i}"])[0]) + "]"
                conn.execute(
                    "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
                    "VALUES (%s,%s,%s,%s,%s::vector)",
                    (doc, ws, i, f"doc {i}", lit),
                )
    try:
        rows = probe(str(ws), ["doc 7"], selectivities=[1.0], ef_values=[200],
                     iterative_modes=["off"], limit=10)
        assert len(rows) == 1
        assert rows[0].recall == pytest.approx(1.0)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL=… uv run pytest tests/test_probe_ann.py -v`
Expected: FAIL — `No module named 'evals.probe_ann'`.

- [ ] **Step 3: Implement**

Create `engine/evals/__init__.py` (empty) and `engine/evals/probe_ann.py`:

```python
"""ANN-vs-exact recall probe.

Answers one question before Phase 2 changes any GUC: how much recall does the
HNSW index actually lose when the permission filter is selective? pgvector's own
README notes that with ef_search=40 and a 10%-selective filter, roughly 4 of 40
rows survive; engine/app/ask/retrieve.py::_dense_ids is that query verbatim, with
LIMIT 40 and ef_search left at its default of 40.

Needs no relevance labels: exact search (enable_indexscan=off) is ground truth.

CAVEAT: run this against the real corpus with real embeddings before deciding.
FakeEmbeddings are uniform on the sphere, which is a pathological distribution for
HNSW and will not predict behaviour on real text.
"""

import argparse
import json
import time
from dataclasses import asdict, dataclass

from app.db import get_conn
from app.ingest.embed import get_provider


@dataclass
class ProbeRow:
    selectivity: float
    ef_search: int
    iterative_scan: str
    recall: float
    ann_ms: float
    exact_ms: float


def _visible_predicate(selectivity: float) -> str:
    """Synthesize an ACL filter of a chosen selectivity without touching real
    permissions: hash the chunk id into [0,1) and keep the bottom slice. Shaped
    like the real predicate — a boolean over each candidate row — so the planner
    sees the same kind of filter."""
    if selectivity >= 1.0:
        return "TRUE"
    return f"(('x' || substr(md5(c.id::text), 1, 8))::bit(32)::bigint / 4294967295.0) < {selectivity}"


def _search(conn, ws: str, qlit: str, pred: str, limit: int, exact: bool,
            ef: int, iterative: str) -> tuple[list[str], float]:
    with conn.transaction():
        if exact:
            conn.execute("SET LOCAL enable_indexscan = off")
            conn.execute("SET LOCAL enable_bitmapscan = off")
        else:
            conn.execute(f"SET LOCAL hnsw.ef_search = {int(ef)}")
            conn.execute(f"SET LOCAL hnsw.iterative_scan = '{iterative}'")
        start = time.perf_counter()
        rows = conn.execute(
            f"SELECT c.id FROM chunks c WHERE c.workspace_id = %s AND c.embedding IS NOT NULL "
            f"AND {pred} ORDER BY c.embedding <=> %s::vector LIMIT %s",
            (ws, qlit, limit),
        ).fetchall()
        elapsed = (time.perf_counter() - start) * 1000.0
    return [str(r[0]) for r in rows], elapsed


def probe(
    workspace_id: str,
    queries: list[str],
    selectivities: list[float],
    ef_values: list[int],
    iterative_modes: list[str],
    limit: int = 40,
) -> list[ProbeRow]:
    provider = get_provider()
    qlits = [
        "[" + ",".join(str(x) for x in provider.embed([q])[0]) + "]" for q in queries
    ]
    out: list[ProbeRow] = []
    with get_conn() as conn:
        for sel in selectivities:
            pred = _visible_predicate(sel)
            truth: list[list[str]] = []
            exact_ms = 0.0
            for qlit in qlits:
                ids, ms = _search(conn, workspace_id, qlit, pred, limit, True, 0, "off")
                truth.append(ids)
                exact_ms += ms
            for ef in ef_values:
                for mode in iterative_modes:
                    hits = 0
                    total = 0
                    ann_ms = 0.0
                    for qlit, gold in zip(qlits, truth):
                        ids, ms = _search(conn, workspace_id, qlit, pred, limit, False, ef, mode)
                        ann_ms += ms
                        gold_set = set(gold)
                        hits += len(gold_set & set(ids))
                        total += len(gold_set)
                    out.append(
                        ProbeRow(
                            selectivity=sel,
                            ef_search=ef,
                            iterative_scan=mode,
                            recall=(hits / total) if total else 1.0,
                            ann_ms=round(ann_ms / max(1, len(qlits)), 2),
                            exact_ms=round(exact_ms / max(1, len(qlits)), 2),
                        )
                    )
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workspace", required=True)
    ap.add_argument("--queries", required=True, help="file with one query per line")
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("--out", default="probe_ann.json")
    args = ap.parse_args()

    with open(args.queries, encoding="utf-8") as fh:
        queries = [line.strip() for line in fh if line.strip()]

    rows = probe(
        args.workspace,
        queries,
        selectivities=[1.0, 0.30, 0.10, 0.02, 0.01, 0.005],
        ef_values=[40, 100, 200, 400],
        iterative_modes=["off", "relaxed_order"],
        limit=args.limit,
    )
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump([asdict(r) for r in rows], fh, indent=2)

    print(f"{'sel':>7} {'ef':>5} {'iterative':>14} {'recall':>7} {'ann_ms':>8} {'exact_ms':>9}")
    for r in rows:
        print(
            f"{r.selectivity:>7.3f} {r.ef_search:>5} {r.iterative_scan:>14} "
            f"{r.recall:>7.3f} {r.ann_ms:>8.2f} {r.exact_ms:>9.2f}"
        )


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test**

Run: `DATABASE_URL=… uv run pytest tests/test_probe_ann.py -v`
Expected: PASS.

- [ ] **Step 5: Run the probe against the demo corpus and record the output**

```bash
cd engine
printf 'data retention\nvendor termination\nexpense approval limit\n' > /tmp/probe-queries.txt
DATABASE_URL=… uv run python -m evals.probe_ann \
  --workspace <workspace-uuid> --queries /tmp/probe-queries.txt --out /tmp/probe_ann.json
```

Paste the printed table into the commit message. **This is the number that decides whether Phase 2
touches `ef_search` at all.**

- [ ] **Step 6: CHANGELOG + commit**

Under `### Added`:

```markdown
- `engine/evals/probe_ann.py` — a label-free ANN-vs-exact recall probe sweeping
  `hnsw.ef_search` × `hnsw.iterative_scan` × synthesized ACL selectivity (100% down to 0.5%), using
  exact search (`enable_indexscan=off`) as ground truth. Run before Phase 2 changes any GUC, so the
  "filtered HNSW loses recall" hypothesis is measured on this corpus rather than assumed.
```

```bash
git add engine/evals engine/tests/test_probe_ann.py CHANGELOG.md
git commit -m "feat: add ANN-vs-exact recall probe"
```

---

### Task 12: Golden-set format and metrics

Labels must survive re-chunking — Phases 3 and 4 change chunk boundaries, and a golden set keyed on
chunk UUIDs would be worthless the day it lands. So gold is expressed as `(filename, verbatim quote)`
and resolved to chunks at eval time.

**Files:**
- Create: `engine/evals/goldenset.py`, `engine/evals/metrics.py`,
  `engine/tests/test_goldenset.py`, `engine/tests/test_metrics.py`
- Modify: `engine/pyproject.toml`, `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `GoldenQuestion` dataclass: `id, question, lang, qtype, answerable: bool,
    gold_filenames: list[str], gold_quotes: list[str], group_names: list[str], all_access: bool,
    must_not_retrieve: list[str]`.
  - `load_golden(path: str) -> list[GoldenQuestion]`, raising `ValueError` with the offending line
    number on a malformed record.
  - `score_question(retrieved: list[dict], q: GoldenQuestion, k: int) -> dict[str, float]` returning
    `{"doc_recall": …, "quote_recall": …, "mrr": …, "ndcg": …}`.
  - `paired_bootstrap(base: dict[str, dict], new: dict[str, dict], metric: str,
    cluster_by: dict[str, str], iters: int = 2000, seed: int = 7) -> tuple[float, float, float]`
    returning `(mean_delta, ci_low, ci_high)`.

- [ ] **Step 1: Add the metrics dependency**

```bash
cd engine && uv add --group dev ranx && uv run python -c "import ranx; print(ranx.__version__)"
```
Expected: a version string. If installation fails on this platform, stop and report — do not
substitute a hand-rolled nDCG silently.

- [ ] **Step 2: Write the failing tests**

Create `engine/tests/test_goldenset.py`:

```python
import json

import pytest

from evals.goldenset import GoldenQuestion, load_golden


def _write(tmp_path, records):
    p = tmp_path / "golden.jsonl"
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in records), encoding="utf-8")
    return str(p)


def test_loads_a_valid_record(tmp_path):
    path = _write(tmp_path, [{
        "id": "q1", "question": "Каков срок хранения данных?", "lang": "ru", "qtype": "lookup",
        "answerable": True, "gold_filenames": ["policy-ru.txt"],
        "gold_quotes": ["срок хранения — 7 лет"], "group_names": ["Finance"],
        "all_access": False, "must_not_retrieve": ["hr-secret.txt"],
    }])
    qs = load_golden(path)
    assert len(qs) == 1
    assert isinstance(qs[0], GoldenQuestion)
    assert qs[0].lang == "ru"
    assert qs[0].must_not_retrieve == ["hr-secret.txt"]


def test_unanswerable_question_needs_no_gold(tmp_path):
    path = _write(tmp_path, [{
        "id": "q2", "question": "What is our policy on Mars colonies?", "lang": "en",
        "qtype": "lookup", "answerable": False, "gold_filenames": [], "gold_quotes": [],
        "group_names": [], "all_access": True, "must_not_retrieve": [],
    }])
    assert load_golden(path)[0].answerable is False


def test_answerable_question_without_gold_is_rejected(tmp_path):
    path = _write(tmp_path, [{
        "id": "q3", "question": "x", "lang": "en", "qtype": "lookup", "answerable": True,
        "gold_filenames": [], "gold_quotes": [], "group_names": [], "all_access": True,
        "must_not_retrieve": [],
    }])
    with pytest.raises(ValueError, match="line 1"):
        load_golden(path)
```

Create `engine/tests/test_metrics.py`:

```python
from evals.goldenset import GoldenQuestion
from evals.metrics import paired_bootstrap, score_question


def _q(**kw):
    base = dict(
        id="q1", question="x", lang="en", qtype="lookup", answerable=True,
        gold_filenames=["a.txt"], gold_quotes=["seven years"], group_names=[],
        all_access=True, must_not_retrieve=[],
    )
    base.update(kw)
    return GoldenQuestion(**base)


def test_perfect_retrieval_scores_one():
    retrieved = [{"filename": "a.txt", "text": "retention is seven years"}]
    s = score_question(retrieved, _q(), k=8)
    assert s["doc_recall"] == 1.0
    assert s["quote_recall"] == 1.0
    assert s["mrr"] == 1.0


def test_wrong_document_scores_zero():
    retrieved = [{"filename": "b.txt", "text": "unrelated"}]
    s = score_question(retrieved, _q(), k=8)
    assert s["doc_recall"] == 0.0
    assert s["quote_recall"] == 0.0
    assert s["mrr"] == 0.0


def test_rank_two_hit_gives_half_mrr():
    retrieved = [
        {"filename": "b.txt", "text": "unrelated"},
        {"filename": "a.txt", "text": "retention is seven years"},
    ]
    assert score_question(retrieved, _q(), k=8)["mrr"] == 0.5


def test_quote_match_ignores_case_and_whitespace():
    retrieved = [{"filename": "a.txt", "text": "Retention  is\nSEVEN   YEARS."}]
    assert score_question(retrieved, _q(), k=8)["quote_recall"] == 1.0


def test_paired_bootstrap_detects_a_real_improvement():
    base = {f"q{i}": {"doc_recall": 0.0} for i in range(40)}
    new = {f"q{i}": {"doc_recall": 1.0} for i in range(40)}
    clusters = {f"q{i}": f"doc{i // 4}" for i in range(40)}
    mean, lo, hi = paired_bootstrap(base, new, "doc_recall", clusters)
    assert mean == 1.0
    assert lo > 0.0


def test_paired_bootstrap_reports_no_change_as_zero():
    base = {f"q{i}": {"doc_recall": 0.5} for i in range(40)}
    clusters = {f"q{i}": f"doc{i // 4}" for i in range(40)}
    mean, lo, hi = paired_bootstrap(base, dict(base), "doc_recall", clusters)
    assert mean == 0.0
    assert lo <= 0.0 <= hi
```

- [ ] **Step 3: Run to verify they fail**

Run: `uv run pytest tests/test_goldenset.py tests/test_metrics.py -v`
Expected: FAIL — `No module named 'evals.goldenset'`.

- [ ] **Step 4: Implement `goldenset.py`**

```python
"""Golden-set records for retrieval evaluation.

Gold is expressed as (filename, verbatim quote), NOT chunk ids. Chunk ids change
every time chunking changes — and Phases 3 and 4 change it deliberately — so a set
keyed on them would be worthless the day it was needed. Filenames and quotes are
stable across re-ingest, re-chunking and re-embedding.
"""

import json
from dataclasses import dataclass


@dataclass
class GoldenQuestion:
    id: str
    question: str
    lang: str                     # "en" | "ru" | "uz"
    qtype: str                    # lookup | comparison | aggregate | enumerate
    answerable: bool
    gold_filenames: list[str]
    gold_quotes: list[str]
    group_names: list[str]        # the principal's access groups
    all_access: bool              # True = ask as an owner
    must_not_retrieve: list[str]  # filenames this principal must never see


_REQUIRED = (
    "id", "question", "lang", "qtype", "answerable", "gold_filenames",
    "gold_quotes", "group_names", "all_access", "must_not_retrieve",
)


def load_golden(path: str) -> list[GoldenQuestion]:
    out: list[GoldenQuestion] = []
    with open(path, encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"line {lineno}: invalid JSON: {e}") from e
            missing = [k for k in _REQUIRED if k not in rec]
            if missing:
                raise ValueError(f"line {lineno}: missing keys {missing}")
            if rec["answerable"] and not (rec["gold_filenames"] and rec["gold_quotes"]):
                raise ValueError(
                    f"line {lineno}: an answerable question needs at least one gold filename "
                    "and one gold quote, otherwise it scores zero forever and silently drags "
                    "every reported metric down"
                )
            out.append(GoldenQuestion(**{k: rec[k] for k in _REQUIRED}))
    return out
```

- [ ] **Step 5: Implement `metrics.py`**

```python
"""Retrieval metrics and a cluster-robust paired bootstrap.

Clustering matters: with several questions drawn from the same source document,
naive standard errors can be ~3x too small, so a real regression looks like noise
and ships.
"""

import math
import random
import re

from ranx import Qrels, Run, evaluate

from .goldenset import GoldenQuestion


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def score_question(retrieved: list[dict], q: GoldenQuestion, k: int) -> dict[str, float]:
    """`retrieved` is an ordered list of {"filename": str, "text": str}, best first."""
    top = retrieved[:k]
    if not q.answerable:
        # An unanswerable question has no gold, so every retrieval metric is
        # meaningless for it — and averaging its structural zero into the means
        # would permanently depress them in proportion to how many unanswerable
        # questions the set contains. run_eval() MUST exclude these from the means
        # and track them separately (see `unanswerable` in its report).
        return {"doc_recall": 0.0, "quote_recall": 0.0, "mrr": 0.0, "ndcg": 0.0}

    gold_files = {_norm(f) for f in q.gold_filenames}
    gold_quotes = [_norm(t) for t in q.gold_quotes]

    hit_ranks = [
        i for i, r in enumerate(top, start=1) if _norm(r.get("filename", "")) in gold_files
    ]
    doc_recall = 1.0 if hit_ranks else 0.0
    mrr = 1.0 / hit_ranks[0] if hit_ranks else 0.0

    texts = [_norm(r.get("text", "")) for r in top]
    found = sum(1 for quote in gold_quotes if any(quote in t for t in texts))
    quote_recall = found / len(gold_quotes) if gold_quotes else 0.0

    # nDCG over the document-level relevance signal, via ranx so the discounting
    # is a well-tested implementation rather than ours.
    qrels = Qrels({q.id: {f: 1 for f in sorted(gold_files)}})
    run = Run({
        q.id: {
            _norm(r.get("filename", "")): float(len(top) - i)
            for i, r in enumerate(top)
        }
    })
    # Pass the metric as a STRING, not a list: ranx returns a bare float for a
    # single metric name and a dict when given a list.
    ndcg = float(evaluate(qrels, run, f"ndcg@{k}")) if top else 0.0

    return {"doc_recall": doc_recall, "quote_recall": quote_recall, "mrr": mrr, "ndcg": ndcg}


def paired_bootstrap(
    base: dict[str, dict],
    new: dict[str, dict],
    metric: str,
    cluster_by: dict[str, str],
    iters: int = 2000,
    seed: int = 7,
) -> tuple[float, float, float]:
    """Mean paired delta (new - base) with a 95% CI, resampling CLUSTERS (source
    documents) rather than questions. Returns (mean, ci_low, ci_high)."""
    shared = [qid for qid in base if qid in new]
    if not shared:
        return (0.0, 0.0, 0.0)

    by_cluster: dict[str, list[float]] = {}
    for qid in shared:
        delta = float(new[qid].get(metric, 0.0)) - float(base[qid].get(metric, 0.0))
        by_cluster.setdefault(cluster_by.get(qid, qid), []).append(delta)

    clusters = sorted(by_cluster)
    all_deltas = [d for c in clusters for d in by_cluster[c]]
    mean = sum(all_deltas) / len(all_deltas)

    rng = random.Random(seed)
    means: list[float] = []
    for _ in range(iters):
        picked = [by_cluster[rng.choice(clusters)] for _ in clusters]
        flat = [d for group in picked for d in group]
        if flat:
            means.append(sum(flat) / len(flat))
    means.sort()
    lo = means[max(0, math.floor(0.025 * len(means)))]
    hi = means[min(len(means) - 1, math.ceil(0.975 * len(means)) - 1)]
    return (mean, lo, hi)
```

- [ ] **Step 6: Run to verify they pass**

Run: `uv run pytest tests/test_goldenset.py tests/test_metrics.py -v`
Expected: PASS.

- [ ] **Step 7: CHANGELOG + commit**

Under `### Added`:

```markdown
- Golden-set format and retrieval metrics (`engine/evals/goldenset.py`, `engine/evals/metrics.py`).
  Gold is `(filename, verbatim quote)` rather than chunk ids, so labels survive the re-chunking that
  Phases 3–4 deliberately perform. Metrics: doc-recall@k, quote-recall@k, MRR and nDCG@k (via `ranx`),
  plus a paired bootstrap whose resampling unit is the **source document**, because with several
  questions per document naive standard errors can be ~3× too small and real regressions read as noise.
```

```bash
git add engine/evals engine/tests/test_goldenset.py engine/tests/test_metrics.py engine/pyproject.toml engine/uv.lock CHANGELOG.md
git commit -m "feat: label-stable golden-set format and cluster-robust metrics"
```

---

### Task 13: Eval runner, fixture set, and the eval CI gate

**Files:**
- Create: `engine/evals/run.py`, `engine/evals/fixtures/corpus/*.txt`,
  `engine/evals/fixtures/golden.jsonl`, `engine/evals/baseline.json`,
  `engine/tests/test_eval_run.py`, `.github/workflows/eval.yml`
- Modify: `.gitignore`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `load_golden`, `score_question`, `paired_bootstrap`, `retrieve`.
- Produces: `run_eval(workspace_id: str, golden_path: str, k: int) -> dict` returning
  `{"per_question": {...}, "means": {...}, "leaks": [...]}`; CLI
  `uv run python -m evals.run --workspace <uuid> --golden <path> [--baseline <path>] [--write-baseline]`.

- [ ] **Step 1: Create the fixture corpus**

Create four small files under `engine/evals/fixtures/corpus/`. Keep them short, synthetic, and
obviously not customer data:

`retention-en.txt`
```
Data Retention Policy

All customer transaction records are retained for seven years from the date of the
transaction. Backup media are destroyed after seven years. The flag CKPT_PREFETCH
controls warmup behaviour in the archival job and defaults to off.
```

`retention-ru.txt`
```
Политика хранения данных

Все записи о транзакциях клиентов хранятся в течение семи лет с даты операции.
Срок хранения резервных копий составляет семь лет. Договор может быть расторгнут
досрочно по письменному уведомлению за тридцать дней.
```

`expenses-uz.txt`
```
Xarajatlar siyosati

Bir million so'mdan ortiq har qanday xarajat bo'lim rahbari tomonidan tasdiqlanishi
kerak. Safar xarajatlari sayohat tugagach o'n kun ichida taqdim etiladi.
```

`hr-confidential-en.txt`
```
Compensation Bands (HR only)

Band 4 salary range is 90,000 to 120,000 per year. This document is restricted to
the HR access group and must never appear in an answer for another group.
```

- [ ] **Step 2: Create the fixture golden set**

`engine/evals/fixtures/golden.jsonl` (one JSON object per line):

```json
{"id":"f1","question":"How long are customer transaction records retained?","lang":"en","qtype":"lookup","answerable":true,"gold_filenames":["retention-en.txt"],"gold_quotes":["retained for seven years"],"group_names":[],"all_access":true,"must_not_retrieve":[]}
{"id":"f2","question":"What does CKPT_PREFETCH control?","lang":"en","qtype":"lookup","answerable":true,"gold_filenames":["retention-en.txt"],"gold_quotes":["controls warmup behaviour"],"group_names":[],"all_access":true,"must_not_retrieve":[]}
{"id":"f3","question":"Сколько лет хранятся записи о транзакциях клиентов?","lang":"ru","qtype":"lookup","answerable":true,"gold_filenames":["retention-ru.txt"],"gold_quotes":["хранятся в течение семи лет"],"group_names":[],"all_access":true,"must_not_retrieve":[]}
{"id":"f4","question":"За сколько дней нужно уведомить о расторжении договора?","lang":"ru","qtype":"lookup","answerable":true,"gold_filenames":["retention-ru.txt"],"gold_quotes":["за тридцать дней"],"group_names":[],"all_access":true,"must_not_retrieve":[]}
{"id":"f5","question":"Kim bir million so'mdan ortiq xarajatni tasdiqlashi kerak?","lang":"uz","qtype":"lookup","answerable":true,"gold_filenames":["expenses-uz.txt"],"gold_quotes":["bo'lim rahbari tomonidan tasdiqlanishi"],"group_names":[],"all_access":true,"must_not_retrieve":[]}
{"id":"f6","question":"How many documents mention retention?","lang":"en","qtype":"aggregate","answerable":true,"gold_filenames":["retention-en.txt","retention-ru.txt"],"gold_quotes":["retained for seven years"],"group_names":[],"all_access":true,"must_not_retrieve":[]}
{"id":"f7","question":"What is our policy on Mars colony travel?","lang":"en","qtype":"lookup","answerable":false,"gold_filenames":[],"gold_quotes":[],"group_names":[],"all_access":true,"must_not_retrieve":[]}
{"id":"f8","question":"What is the Band 4 salary range?","lang":"en","qtype":"lookup","answerable":false,"gold_filenames":[],"gold_quotes":[],"group_names":["Everyone"],"all_access":false,"must_not_retrieve":["hr-confidential-en.txt"]}
```

`f8` is the permission-negative case: a non-HR principal asking an HR question must retrieve nothing
from `hr-confidential-en.txt`.

- [ ] **Step 3: Write the failing test**

Create `engine/tests/test_eval_run.py`:

```python
import os

import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_fixture_eval_runs_and_finds_no_permission_leak():
    """The gate that must never go red for the wrong reason: a member principal
    must never retrieve an HR-restricted document."""
    from evals.run import seed_fixture_workspace, run_eval

    ws = seed_fixture_workspace()
    try:
        report = run_eval(ws, "evals/fixtures/golden.jsonl", k=8)
        assert report["leaks"] == [], report["leaks"]
        # f7 and f8 are unanswerable: they carry no gold, so they must be scored
        # separately and must NOT be averaged into the means as structural zeros.
        assert set(report["per_question"]) == {"f1", "f2", "f3", "f4", "f5", "f6"}
        assert set(report["unanswerable"]) == {"f7", "f8"}
        assert report["means"]["n_answerable"] == 6.0
        assert report["means"]["n_unanswerable"] == 2.0
        # With FakeEmbeddings the dense arm is not semantic, so only assert on the
        # lexical-driven exact-token question, which must always be findable.
        assert report["per_question"]["f2"]["doc_recall"] == 1.0
    finally:
        from evals.run import drop_fixture_workspace

        drop_fixture_workspace(ws)
```

- [ ] **Step 4: Run to verify it fails**

Run: `DATABASE_URL=… uv run pytest tests/test_eval_run.py -v`
Expected: FAIL — `No module named 'evals.run'`.

- [ ] **Step 5: Implement `run.py`**

```python
"""Retrieval evaluation runner.

Two modes:
  * fixture (CI)  — synthetic corpus, deterministic fake providers, no network.
                    Gates on INVARIANTS: zero permission leaks, exact-token recall,
                    and no paired regression against the committed baseline.
  * real          — point --golden at the pilot's golden set with real models
                    configured. Those files are customer data and are never committed.
"""

import argparse
import json
import os
import pathlib
import uuid

from app.db import get_conn
from app.ingest.store import process_document
from app.ask.retrieve import retrieve

from .goldenset import GoldenQuestion, load_golden
from .metrics import paired_bootstrap, score_question

FIXTURE_CORPUS = pathlib.Path(__file__).parent / "fixtures" / "corpus"
GATED_METRICS = ("doc_recall", "quote_recall", "ndcg")


def seed_fixture_workspace() -> str:
    """Create a throwaway workspace, ingest the fixture corpus through the real
    pipeline, and restrict the HR document to an HR-only group."""
    ws = str(uuid.uuid4())
    with get_conn() as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO workspaces (id, name, slug) VALUES (%s,'eval',%s)", (ws, ws)
            )
            conn.execute(
                "INSERT INTO groups (workspace_id, name, slug, is_default) "
                "VALUES (%s,'Everyone',%s,true)",
                (ws, f"everyone-{ws}"),
            )
            hr = conn.execute(
                "INSERT INTO groups (workspace_id, name, slug, is_default) "
                "VALUES (%s,'HR',%s,false) RETURNING id",
                (ws, f"hr-{ws}"),
            ).fetchone()[0]

    for path in sorted(FIXTURE_CORPUS.glob("*.txt")):
        data = path.read_bytes()
        with get_conn() as conn:
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,%s,'text/plain',%s,%s,'uploaded') RETURNING id",
                (ws, path.name, len(data), f"eval/{path.name}"),
            ).fetchone()[0]
            everyone = conn.execute(
                "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (ws,)
            ).fetchone()[0]
            with conn.transaction():
                conn.execute(
                    "INSERT INTO ingestion_jobs (document_id, workspace_id, status) "
                    "VALUES (%s,%s,'queued')",
                    (doc, ws),
                )
                target = hr if path.name.startswith("hr-") else everyone
                conn.execute(
                    "INSERT INTO document_groups (document_id, workspace_id, group_id) "
                    "VALUES (%s,%s,%s)",
                    (doc, ws, target),
                )
        process_document(str(doc), ws, path.name, "text/plain", data)
    return ws


def drop_fixture_workspace(ws: str) -> None:
    with get_conn() as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def _group_ids(ws: str, names: list[str]) -> list[str]:
    if not names:
        return []
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id FROM groups WHERE workspace_id=%s AND name = ANY(%s)", (ws, names)
        ).fetchall()
    return [str(r[0]) for r in rows]


def run_eval(workspace_id: str, golden_path: str, k: int = 8) -> dict:
    questions: list[GoldenQuestion] = load_golden(golden_path)
    per_question: dict[str, dict] = {}   # ANSWERABLE only — these drive the means
    unanswerable: dict[str, dict] = {}
    clusters: dict[str, str] = {}
    leaks: list[dict] = []

    for q in questions:
        hits, dbg = retrieve(
            workspace_id,
            q.question,
            k=k,
            group_ids=_group_ids(workspace_id, q.group_names),
            all_access=q.all_access,
        )
        retrieved = [{"filename": h.filename, "text": h.text} for h in hits]
        # Permission checks apply to EVERY question, answerable or not.
        for forbidden in q.must_not_retrieve:
            if any(r["filename"] == forbidden for r in retrieved):
                leaks.append({"question": q.id, "document": forbidden})

        if not q.answerable:
            # No gold exists, so retrieval metrics are undefined. Averaging their
            # structural zeros into the means would depress every reported number
            # in proportion to the unanswerable share of the set (the spec calls
            # for 20 of 120). Tracked separately; whether the ANSWER refuses is a
            # Phase 5 metric, not a retrieval one.
            unanswerable[q.id] = {"retrieved_n": float(len(retrieved))}
            continue

        scores = score_question(retrieved, q, k)
        scores["lexical_n"] = float(dbg.lexical_n)
        scores["degraded_n"] = float(len(dbg.degraded))
        per_question[q.id] = scores
        clusters[q.id] = (q.gold_filenames or [q.id])[0]

    means = {
        m: (sum(s[m] for s in per_question.values()) / len(per_question) if per_question else 0.0)
        for m in (*GATED_METRICS, "mrr", "lexical_n", "degraded_n")
    }
    means["n_answerable"] = float(len(per_question))
    means["n_unanswerable"] = float(len(unanswerable))
    return {
        "per_question": per_question,
        "unanswerable": unanswerable,
        "means": means,
        "leaks": leaks,
        "clusters": clusters,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workspace", help="existing workspace id; omit to seed the fixture corpus")
    ap.add_argument("--golden", default="evals/fixtures/golden.jsonl")
    ap.add_argument("--baseline", default="evals/baseline.json")
    ap.add_argument("--write-baseline", action="store_true")
    ap.add_argument("--k", type=int, default=8)
    args = ap.parse_args()

    ws, seeded = (args.workspace, False)
    if not ws:
        ws, seeded = seed_fixture_workspace(), True
    try:
        report = run_eval(ws, args.golden, args.k)
    finally:
        if seeded:
            drop_fixture_workspace(ws)

    print(json.dumps(report["means"], indent=2))

    if report["leaks"]:
        for leak in report["leaks"]:
            print(f"PERMISSION LEAK: question {leak['question']} retrieved {leak['document']}")
        return 1

    if args.write_baseline:
        with open(args.baseline, "w", encoding="utf-8") as fh:
            json.dump(report["per_question"], fh, indent=2, sort_keys=True)
        print(f"baseline written to {args.baseline}")
        return 0

    if not os.path.exists(args.baseline):
        print(f"no baseline at {args.baseline}; run with --write-baseline to create one")
        return 0

    with open(args.baseline, encoding="utf-8") as fh:
        base = json.load(fh)

    failed = False
    for metric in GATED_METRICS:
        mean, lo, hi = paired_bootstrap(base, report["per_question"], metric, report["clusters"])
        verdict = "REGRESSION" if hi < 0 else ("improvement" if lo > 0 else "no change")
        print(f"{metric:>13}: delta {mean:+.4f}  95% CI [{lo:+.4f}, {hi:+.4f}]  {verdict}")
        if hi < 0:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 6: Run the test**

Run: `DATABASE_URL=… uv run pytest tests/test_eval_run.py -v`
Expected: PASS, `leaks == []`.

- [ ] **Step 7: Write the first baseline**

```bash
cd engine
DATABASE_URL=… uv run python -m evals.run --write-baseline
```
Expected: `engine/evals/baseline.json` created; the printed means are the corpus's starting numbers.
**Paste them into the commit message** — this is the repo's first recorded accuracy measurement.

- [ ] **Step 8: Add the eval workflow**

Create `.github/workflows/eval.yml` — identical service/setup block to `ci.yml`, with the final step:

```yaml
      - name: Retrieval eval (fixture corpus, fake providers, no network)
        run: uv run python -m evals.run --golden evals/fixtures/golden.jsonl
        working-directory: engine
```

- [ ] **Step 9: Prove there is no egress on the ingest or ask paths**

Spec §9 success criterion 7. Create `engine/tests/test_no_egress.py`:

```python
import os
import uuid

import httpx
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_ingest_and_ask_make_no_outbound_calls(monkeypatch):
    """With no MODELS_BASE_URL configured, the deterministic fake providers must
    carry the entire pipeline. Any outbound HTTP from a customer's air-gapped
    deployment kills the deal and cannot be walked back."""

    def forbidden(*args, **kwargs):
        raise AssertionError(f"outbound HTTP attempted: {args[:1]}")

    monkeypatch.setattr(httpx, "post", forbidden)
    monkeypatch.setattr(httpx, "get", forbidden)

    from app.ask.retrieve import retrieve
    from evals.run import drop_fixture_workspace, seed_fixture_workspace

    ws = seed_fixture_workspace()
    try:
        hits, dbg = retrieve(ws, "How long are records retained?", all_access=True)
        assert dbg.dense_n >= 0  # completed without touching the network
    finally:
        drop_fixture_workspace(ws)
```

Run: `DATABASE_URL=… uv run pytest tests/test_no_egress.py -v` — expected PASS with no
`MODELS_BASE_URL` and no `OPENAI_API_KEY` in the environment. If it fails, a real provider is being
selected when it should not be; fix `use_real_models()` selection rather than the test.

- [ ] **Step 10: Keep customer data out of the repo**

Append to `.gitignore`:

```
# Customer golden sets and corpora are never committed.
engine/evals/local/
engine/evals/*.local.jsonl
probe_ann.json
```

- [ ] **Step 11: CHANGELOG + commit**

Under `### Added`:

```markdown
- **Retrieval evaluation harness and its CI gate** (`engine/evals/run.py`,
  `.github/workflows/eval.yml`). Seeds a throwaway workspace from a committed synthetic EN/RU/UZ
  fixture corpus through the real ingest pipeline, runs each golden question as the principal it
  specifies, and reports doc-recall@8, quote-recall@8, nDCG@8 and MRR plus the lexical-arm row count
  and degradation count. Gates on three things: **any permission leak fails the build outright**
  (a member principal retrieving an HR-restricted document), a paired-bootstrap regression against
  `engine/evals/baseline.json` fails it, and the whole run happens with deterministic fake providers
  so CI needs no GPU, no credentials and no network. Customer golden sets and corpora stay outside
  the repo by `.gitignore`.
```

```bash
git add engine/evals .github/workflows/eval.yml engine/tests/test_eval_run.py engine/tests/test_no_egress.py .gitignore CHANGELOG.md
git commit -m "feat: retrieval eval harness with permission-leak and regression gates"
```

---

### Task 14: The attribution table

The deliverable of Phase 1: a written apportionment of the accuracy complaint across the candidate
causes, using the instruments built above. Nothing is fixed here — this is the document Phase 2 is
planned from.

**Files:**
- Create: `docs/product/<the date you write it, YYYY-MM-DD>-retrieval-attribution.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `evals/run.py` output, `evals/probe_ann.py` output, `query_log` telemetry.
- Produces: the input to Phase 2's plan.

- [ ] **Step 1: Run the eval against the pilot corpus with real models**

```bash
cd engine
MODELS_BASE_URL=<self-hosted endpoint> DATABASE_URL=… \
  uv run python -m evals.run --workspace <pilot-workspace-uuid> --golden <path-to-real-golden-set>
```

Record the per-language means. **`--golden` must point outside the repo.**

- [ ] **Step 2: Run the ANN probe against the pilot corpus**

```bash
DATABASE_URL=… uv run python -m evals.probe_ann \
  --workspace <pilot-workspace-uuid> --queries <path-to-real-queries> --out /tmp/probe_ann.json
```

- [ ] **Step 3: Query the telemetry for degradation rates**

```sql
SELECT
  count(*)                                                        AS queries,
  avg((candidate_counts->>'lexical')::int)                        AS avg_lexical_rows,
  count(*) FILTER (WHERE 'lexical_arm_empty' = ANY(degraded))::float / count(*) AS pct_lexical_dead,
  count(*) FILTER (WHERE NOT rerank_applied)::float / count(*)    AS pct_rerank_skipped,
  count(*) FILTER (WHERE 'answer_uncited' = ANY(degraded))::float / count(*)    AS pct_uncited,
  question_type,
  count(*) FILTER (WHERE question_type IS NOT NULL)::float / count(*) AS share
FROM query_log
WHERE workspace_id = '<pilot-workspace-uuid>' AND created_at > now() - interval '7 days'
GROUP BY question_type
ORDER BY count(*) DESC;
```

- [ ] **Step 4: Write the attribution document**

A table with one row per candidate cause from spec §1.2 and these columns: *cause · measured evidence ·
estimated share of the complaint · fix phase · confidence*. Then a short section: **what Phase 2 should
and should not do given the numbers** — in particular, whether `ef_search` earns its slot, and whether
the aggregate question share clears the ~15% bar that gates D3.

- [ ] **Step 5: CHANGELOG + commit**

```markdown
- Retrieval accuracy attribution (`docs/product/2026-08-…-retrieval-attribution.md`) — the measured
  apportionment of the accuracy complaint across the eleven candidate causes, from the eval harness,
  the ANN probe and one week of `query_log` telemetry. Phase 2 is planned from this table rather than
  from the hypothesis.
```

```bash
git add docs/product CHANGELOG.md
git commit -m "docs: measured attribution of the retrieval accuracy complaint"
```

---

## Done criteria for Phase 1

1. `.github/workflows/ci.yml` and `eval.yml` are green, and the ten previously-skipped test files run.
2. Re-ingesting a document leaves every historical citation resolvable with its snippet intact.
3. `uv run python -m evals.run` prints per-metric means and exits non-zero on a permission leak.
4. `engine/evals/baseline.json` exists and holds real per-question numbers.
5. The probe table exists, showing ANN recall against ACL selectivity on the pilot corpus.
6. The attribution document names which causes actually mattered, with evidence.
