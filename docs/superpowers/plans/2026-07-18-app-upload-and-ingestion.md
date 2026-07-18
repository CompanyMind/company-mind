# App Dataset Upload & Ingestion — Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in user uploads documents (PDF/Word/txt/md) into their workspace; the engine parses → chunks → embeds (on self-hosted models) → stores them in pgvector; the dashboard shows each file move from `uploaded` to `indexed`.

**Architecture:** `web` accepts the upload, stores the original file, creates `documents` + `ingestion_jobs` rows, then hands the **file bytes over HTTP** to the private `engine` (guarded by an internal secret). The engine parses/chunks/embeds and writes `chunks` (with vectors) + status back to the shared Postgres. Passing bytes over HTTP — not a shared volume — keeps it working whether the engine runs in Docker or on a separate GPU box.

**Tech Stack:** (web) Next.js 16 route handlers + Drizzle + pgvector column; (engine) FastAPI BackgroundTasks, pypdf, python-docx, psycopg + pgvector, an OpenAI-compatible embeddings client with a deterministic fake fallback.

This is **Plan 2 of 3** (builds on Plan 1's foundation + auth). Plan 3 = Ask & Citations. This plan produces working, testable software: documents get indexed end to end.

## Global Constraints

Inherits Plan 1's constraints. Additional/emphasized for this plan:

- **Embedding dimension is pinned:** `EMBED_DIM = 1024`, declared once on each side (`web/lib/db/schema.ts` vector column + `engine/app/settings.py`). Changing it requires regenerating the migration and re-embedding — cheap now (empty DB), expensive later. Do not scatter the literal.
- **Engine owns no filesystem contract with web:** the engine receives file bytes in the `/ingest` request. No shared upload volume.
- **Engine writes to shared tables via raw SQL** (psycopg) matching the Drizzle schema exactly. The Drizzle schema in `web/` is the source of truth for column names/types.
- **Every engine DB write is `workspace_id`-scoped**, same as web.
- **`/ingest` is authenticated** by the `X-Engine-Secret: $ENGINE_INTERNAL_SECRET` header; a missing/wrong secret is `401`. The browser never calls the engine.
- **Allowed uploads:** MIME/extension in {pdf, docx, txt, md}; per-file cap **25 MB**. Anything else is rejected before storage.
- **CSRF:** state-changing web routes (upload) require a double-submit token (cookie value must equal an `x-csrf-token` header), in addition to SameSite=Lax.
- **Self-hosted models:** embeddings go to `${MODELS_BASE_URL}/embeddings` (OpenAI-compatible; `MODELS_BASE_URL` ends in `/v1`). When unset, a deterministic **fake** provider is used so dev/test runs without the GPU box. No embedding text ever leaves the deployment on the real path.

---

## File Structure

**Web — created:**
- `web/lib/csrf.ts` — issue/verify double-submit token
- `web/lib/storage.ts` — save/read original files under `STORAGE_DIR`
- `web/lib/engine.ts` — server-only client: POST bytes to engine `/ingest`
- `web/lib/documents.ts` — workspace-scoped queries for the documents list
- `web/app/api/documents/route.ts` — `POST` (upload) + `GET` (list)
- `web/app/(app)/dashboard/Sources.tsx` — client component: upload + polling status list

**Web — modified:**
- `web/lib/db/schema.ts` — add `documents`, `ingestionJobs`, `chunks`
- `web/app/(app)/dashboard/page.tsx` — render `<Sources/>`
- `web/lib/db/migrations/*` — generated migration for the new tables
- root `docker-compose.yml` + `.env`/`.env.example` — `STORAGE_DIR` + `uploads` volume on web; `EMBED_DIM`

**Engine — created:**
- `engine/app/ingest/__init__.py`
- `engine/app/ingest/parse.py` — `extract_text(filename, mime, data) -> ParsedDoc`
- `engine/app/ingest/chunk.py` — `chunk_text(text, pages) -> list[Chunk]`
- `engine/app/ingest/embed.py` — `get_provider()`, `OpenAICompatEmbeddings`, `FakeEmbeddings`
- `engine/app/ingest/store.py` — `store_chunks(...)`, status updates (psycopg + pgvector)
- `engine/app/db.py` — psycopg connection helper + `register_vector`
- `engine/app/security.py` — internal-secret dependency
- `engine/tests/test_parse.py`, `test_chunk.py`, `test_embed.py`

**Engine — modified:**
- `engine/pyproject.toml` — add `pypdf`, `python-docx`, `pgvector`
- `engine/app/settings.py` — add `embed_dim: int = 1024`
- `engine/app/main.py` — mount the `/ingest` route

---

## Task 1: Schema — documents, ingestion_jobs, chunks (+ vector)

**Files:**
- Modify: `web/lib/db/schema.ts`
- Create (generated): `web/lib/db/migrations/00xx_*.sql`

**Interfaces:**
- Produces Drizzle tables `documents`, `ingestionJobs`, `chunks`. `chunks.embedding` is `vector(1024)`. Column names other code depends on are exactly as below.

- [ ] **Step 1: Append tables to `web/lib/db/schema.ts`**

```ts
import {
  pgTable, uuid, text, timestamp, integer, index, vector, bigint,
} from 'drizzle-orm/pg-core'

// EMBED_DIM — pinned. Must equal engine/app/settings.py embed_dim.
export const EMBED_DIM = 1024

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    status: text('status').notNull().default('uploaded'), // uploaded|parsing|indexed|failed
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('documents_workspace_idx').on(t.workspaceId)],
)

export const ingestionJobs = pgTable('ingestion_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'), // queued|running|done|failed
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    text: text('text').notNull(),
    page: integer('page'),
    charStart: integer('char_start'),
    charEnd: integer('char_end'),
    tokenCount: integer('token_count'),
    embedding: vector('embedding', { dimensions: EMBED_DIM }),
  },
  (t) => [
    index('chunks_workspace_idx').on(t.workspaceId),
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
)
```

Note: `workspaces`/`documents` are already imported/declared in this file — keep the single import block; add `integer`, `vector`, `bigint`, `index` to it if missing.

- [ ] **Step 2: Generate the migration**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web && npm run db:generate
```
Expected: a new migration file adding the three tables + the hnsw index. If drizzle-kit does not emit the `USING hnsw (...)` index, add this line manually to the generated `.sql` (with a `--> statement-breakpoint` before it):
`CREATE INDEX "chunks_embedding_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);`

- [ ] **Step 3: Apply and verify**

```bash
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" npm run db:migrate
cd /Users/dovud/Developer/personal/startup/compbrain
docker compose exec -T db psql -U compbrain -d compbrain -c "\d chunks" | grep -E "embedding|vector"
```
Expected: `embedding | vector(1024)`.

- [ ] **Step 4: Commit**

```bash
git add web/lib/db/schema.ts web/lib/db/migrations
git commit -m "Schema: documents, ingestion_jobs, chunks (vector(1024)) + hnsw index"
```

---

## Task 2: Web storage module + compose wiring

**Files:**
- Create: `web/lib/storage.ts`
- Modify: `docker-compose.yml`, `.env.example`, `.env`
- Modify: `web/lib/env.ts` (add `STORAGE_DIR`)

**Interfaces:**
- Produces `saveFile(workspaceId: string, filename: string, data: Buffer): Promise<{ storageKey: string; bytes: number }>` and `readFile(storageKey: string): Promise<Buffer>`. `STORAGE_DIR` defaults to `./.storage` in dev.

- [ ] **Step 1: Add `STORAGE_DIR` to `web/lib/env.ts`** (getter, defaulted)

```ts
  get STORAGE_DIR() {
    return process.env.STORAGE_DIR ?? '.storage'
  },
```

- [ ] **Step 2: Create `web/lib/storage.ts`**

```ts
import 'server-only'
import { mkdir, writeFile, readFile as fsReadFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from '@/lib/env'

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file'
}

export async function saveFile(
  workspaceId: string,
  filename: string,
  data: Buffer,
): Promise<{ storageKey: string; bytes: number }> {
  const storageKey = `${workspaceId}/${randomUUID()}-${safeName(filename)}`
  const abs = join(env.STORAGE_DIR, storageKey)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, data)
  return { storageKey, bytes: data.byteLength }
}

export async function readFile(storageKey: string): Promise<Buffer> {
  return fsReadFile(join(env.STORAGE_DIR, storageKey))
}
```

- [ ] **Step 3: Wire compose** — in `docker-compose.yml`, add to the `web` service an `uploads` volume + `STORAGE_DIR`, and add `EMBED_DIM` to `engine`. Under `web:` `environment:` add `STORAGE_DIR: /data/uploads`; under `web:` add `volumes: [ "uploads:/data/uploads" ]`; under `engine:` `environment:` add `EMBED_DIM: ${EMBED_DIM}`. Add `uploads:` under top-level `volumes:`.

- [ ] **Step 4: Add to `.env.example` and `.env`**

```bash
# append to both
STORAGE_DIR=.storage
EMBED_DIM=1024
```
(In compose, web overrides `STORAGE_DIR=/data/uploads`; the `.storage` default is for host dev.)

- [ ] **Step 5: Add `.storage/` to root `.gitignore`** (uploaded files are never committed)

```bash
printf '\n# uploaded files (dev)\n/web/.storage/\n' >> /Users/dovud/Developer/personal/startup/compbrain/.gitignore
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/storage.ts web/lib/env.ts docker-compose.yml .env.example .gitignore
git commit -m "Web file storage module + uploads volume + EMBED_DIM env"
```

---

## Task 3: Engine deps, settings, DB helper, security guard

**Files:**
- Modify: `engine/pyproject.toml`, `engine/app/settings.py`, `engine/app/main.py`
- Create: `engine/app/db.py`, `engine/app/security.py`

**Interfaces:**
- Produces `settings.embed_dim` (int, 1024); `get_conn()` (psycopg connection with pgvector registered); `require_secret` FastAPI dependency raising 401 on mismatch.

- [ ] **Step 1: Add engine deps**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/engine
uv add pypdf python-docx pgvector
```

- [ ] **Step 2: Add `embed_dim` to `engine/app/settings.py`** — add field `embed_dim: int = 1024` to the `Settings` class.

- [ ] **Step 3: Create `engine/app/db.py`**

```python
import psycopg
from pgvector.psycopg import register_vector
from .settings import settings

def get_conn() -> psycopg.Connection:
    conn = psycopg.connect(settings.database_url)
    register_vector(conn)
    return conn
```

- [ ] **Step 4: Create `engine/app/security.py`**

```python
from fastapi import Header, HTTPException
from .settings import settings

def require_secret(x_engine_secret: str = Header(default="")) -> None:
    if not settings.engine_internal_secret or x_engine_secret != settings.engine_internal_secret:
        raise HTTPException(status_code=401, detail="bad engine secret")
```

- [ ] **Step 5: Commit**

```bash
git add engine/pyproject.toml engine/uv.lock engine/app/settings.py engine/app/db.py engine/app/security.py
git commit -m "Engine: deps (pypdf, python-docx, pgvector), db helper, internal-secret guard"
```

---

## Task 4: Engine parse module (TDD)

**Files:**
- Create: `engine/app/ingest/__init__.py`, `engine/app/ingest/parse.py`
- Test: `engine/tests/test_parse.py`

**Interfaces:**
- Produces `ParsedDoc` (dataclass: `text: str`, `pages: list[Page]`) and `Page` (dataclass: `page: int`, `start: int`, `end: int`); `extract_text(filename: str, mime: str, data: bytes) -> ParsedDoc`. `pages` are char ranges over `text`. Raises `UnsupportedType` for unknown kinds.

- [ ] **Step 1: Write failing test** `engine/tests/test_parse.py`

```python
from app.ingest.parse import extract_text, UnsupportedType
import pytest

def test_txt_single_page():
    doc = extract_text("a.txt", "text/plain", b"hello world")
    assert doc.text == "hello world"
    assert len(doc.pages) == 1
    assert doc.pages[0].start == 0 and doc.pages[0].end == len("hello world")

def test_markdown_is_text():
    doc = extract_text("a.md", "text/markdown", b"# Title\n\nBody")
    assert "Title" in doc.text and "Body" in doc.text

def test_unsupported_raises():
    with pytest.raises(UnsupportedType):
        extract_text("a.exe", "application/octet-stream", b"\x00")
```

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/engine && uv run pytest tests/test_parse.py -q
```
Expected: FAIL (module missing).

- [ ] **Step 3: Create `engine/app/ingest/__init__.py`** (empty) and `engine/app/ingest/parse.py`

```python
from dataclasses import dataclass
from io import BytesIO


class UnsupportedType(Exception):
    pass


@dataclass
class Page:
    page: int
    start: int
    end: int


@dataclass
class ParsedDoc:
    text: str
    pages: list[Page]


def _from_pages(page_texts: list[str]) -> ParsedDoc:
    """Join per-page texts with form feeds and record each page's char range."""
    parts: list[str] = []
    pages: list[Page] = []
    cursor = 0
    for i, pt in enumerate(page_texts, start=1):
        if i > 1:
            parts.append("\n\n")
            cursor += 2
        start = cursor
        parts.append(pt)
        cursor += len(pt)
        pages.append(Page(page=i, start=start, end=cursor))
    return ParsedDoc(text="".join(parts), pages=pages)


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def extract_text(filename: str, mime: str, data: bytes) -> ParsedDoc:
    ext = _ext(filename)
    if ext in ("txt", "md") or mime in ("text/plain", "text/markdown"):
        text = data.decode("utf-8", errors="replace")
        return ParsedDoc(text=text, pages=[Page(page=1, start=0, end=len(text))])
    if ext == "pdf" or mime == "application/pdf":
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(data))
        return _from_pages([(p.extract_text() or "") for p in reader.pages])
    if ext == "docx" or mime in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        import docx

        d = docx.Document(BytesIO(data))
        text = "\n".join(p.text for p in d.paragraphs)
        return ParsedDoc(text=text, pages=[Page(page=1, start=0, end=len(text))])
    raise UnsupportedType(f"{filename} ({mime})")
```

- [ ] **Step 4: Run — expect pass**

```bash
uv run pytest tests/test_parse.py -q
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/app/ingest engine/tests/test_parse.py
git commit -m "Engine parse: txt/md/pdf/docx -> text + page ranges (TDD)"
```

---

## Task 5: Engine chunk module (TDD)

**Files:**
- Create: `engine/app/ingest/chunk.py`
- Test: `engine/tests/test_chunk.py`

**Interfaces:**
- Produces `Chunk` (dataclass: `ordinal: int`, `text: str`, `page: int | None`, `char_start: int`, `char_end: int`, `token_count: int`) and `chunk_text(text: str, pages: list[Page], target_tokens: int = 120, overlap: int = 20) -> list[Chunk]`. Token count is a whitespace-word approximation. Offsets index into `text`. Each chunk's `page` is the page containing its `char_start`.

- [ ] **Step 1: Write failing test** `engine/tests/test_chunk.py`

```python
from app.ingest.parse import Page
from app.ingest.chunk import chunk_text

def test_chunks_cover_text_with_offsets():
    text = " ".join(f"w{i}" for i in range(300))
    pages = [Page(page=1, start=0, end=len(text))]
    chunks = chunk_text(text, pages, target_tokens=50, overlap=10)
    assert len(chunks) >= 5
    # offsets are valid and the slice matches the stored text
    for c in chunks:
        assert 0 <= c.char_start < c.char_end <= len(text)
        assert text[c.char_start:c.char_end] == c.text
        assert c.page == 1
    # ordinals are 0..n-1 in order
    assert [c.ordinal for c in chunks] == list(range(len(chunks)))

def test_overlap_repeats_words():
    text = " ".join(f"w{i}" for i in range(100))
    pages = [Page(page=1, start=0, end=len(text))]
    chunks = chunk_text(text, pages, target_tokens=30, overlap=10)
    # consecutive chunks share some text due to overlap
    assert chunks[1].char_start < chunks[0].char_end
```

- [ ] **Step 2: Run — expect fail**

```bash
uv run pytest tests/test_chunk.py -q
```
Expected: FAIL.

- [ ] **Step 3: Create `engine/app/ingest/chunk.py`**

```python
from dataclasses import dataclass
import re

from .parse import Page


@dataclass
class Chunk:
    ordinal: int
    text: str
    page: int | None
    char_start: int
    char_end: int
    token_count: int


def _page_for(pages: list[Page], pos: int) -> int | None:
    for p in pages:
        if p.start <= pos < p.end:
            return p.page
    return pages[-1].page if pages else None


def chunk_text(
    text: str,
    pages: list[Page],
    target_tokens: int = 120,
    overlap: int = 20,
) -> list[Chunk]:
    # Tokens ~= whitespace-delimited words; keep each word's char span.
    words = [(m.group(0), m.start(), m.end()) for m in re.finditer(r"\S+", text)]
    if not words:
        return []
    step = max(1, target_tokens - overlap)
    chunks: list[Chunk] = []
    ordinal = 0
    for i in range(0, len(words), step):
        window = words[i : i + target_tokens]
        if not window:
            break
        start = window[0][1]
        end = window[-1][2]
        chunks.append(
            Chunk(
                ordinal=ordinal,
                text=text[start:end],
                page=_page_for(pages, start),
                char_start=start,
                char_end=end,
                token_count=len(window),
            )
        )
        ordinal += 1
        if i + target_tokens >= len(words):
            break
    return chunks
```

- [ ] **Step 4: Run — expect pass**

```bash
uv run pytest tests/test_chunk.py -q
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/app/ingest/chunk.py engine/tests/test_chunk.py
git commit -m "Engine chunk: token-aware overlapping chunks preserving offsets (TDD)"
```

---

## Task 6: Engine embeddings provider (TDD, fake fallback)

**Files:**
- Create: `engine/app/ingest/embed.py`
- Test: `engine/tests/test_embed.py`

**Interfaces:**
- Produces `EmbeddingsProvider` protocol with `embed(texts: list[str]) -> list[list[float]]`; `FakeEmbeddings(dim)`; `OpenAICompatEmbeddings(base_url, model, dim)`; `get_provider() -> EmbeddingsProvider` (returns Fake when `settings.models_base_url` is empty, else OpenAI-compatible). All vectors have length `settings.embed_dim`.

- [ ] **Step 1: Write failing test** `engine/tests/test_embed.py`

```python
from app.ingest.embed import FakeEmbeddings

def test_fake_is_deterministic_and_right_dim():
    p = FakeEmbeddings(dim=1024)
    a = p.embed(["hello", "world"])
    b = p.embed(["hello", "world"])
    assert len(a) == 2 and len(a[0]) == 1024
    assert a == b                       # deterministic
    assert p.embed(["hello"])[0] != p.embed(["different"])[0]
```

- [ ] **Step 2: Run — expect fail**

```bash
uv run pytest tests/test_embed.py -q
```
Expected: FAIL.

- [ ] **Step 3: Create `engine/app/ingest/embed.py`**

```python
import hashlib
import math
from typing import Protocol

import httpx

from ..settings import settings


class EmbeddingsProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class FakeEmbeddings:
    """Deterministic, unit-norm pseudo-embeddings from a text hash. Dev/test only —
    structurally valid (right dim, stable) but not semantic."""

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def _vec(self, text: str) -> list[float]:
        vals: list[float] = []
        counter = 0
        while len(vals) < self.dim:
            h = hashlib.sha256(f"{text}:{counter}".encode()).digest()
            for i in range(0, len(h), 4):
                if len(vals) >= self.dim:
                    break
                n = int.from_bytes(h[i : i + 4], "big")
                vals.append((n / 2**32) * 2 - 1)  # [-1, 1)
            counter += 1
        norm = math.sqrt(sum(v * v for v in vals)) or 1.0
        return [v / norm for v in vals]

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]


class OpenAICompatEmbeddings:
    def __init__(self, base_url: str, model: str, dim: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        r = httpx.post(
            f"{self.base_url}/embeddings",
            json={"model": self.model, "input": texts},
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()["data"]
        return [row["embedding"] for row in data]


def get_provider() -> EmbeddingsProvider:
    if settings.models_base_url:
        return OpenAICompatEmbeddings(settings.models_base_url, settings.embed_model, settings.embed_dim)
    return FakeEmbeddings(settings.embed_dim)
```

- [ ] **Step 4: Run — expect pass**

```bash
uv run pytest tests/test_embed.py -q
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/app/ingest/embed.py engine/tests/test_embed.py
git commit -m "Engine embeddings: OpenAI-compatible provider + deterministic fake fallback (TDD)"
```

---

## Task 7: Engine store + /ingest orchestration

**Files:**
- Create: `engine/app/ingest/store.py`
- Modify: `engine/app/main.py`

**Interfaces:**
- Consumes: `extract_text` (T4), `chunk_text` (T5), `get_provider` (T6), `get_conn` (T3), `require_secret` (T3).
- Produces: `POST /ingest` (multipart: `file`, `document_id`, `workspace_id`; header `X-Engine-Secret`) → `202 {"status":"accepted"}`; background processing sets `documents.status`/`ingestion_jobs.status` and writes `chunks`.

- [ ] **Step 1: Create `engine/app/ingest/store.py`**

```python
from datetime import datetime, timezone

from ..db import get_conn
from .parse import extract_text
from .chunk import chunk_text
from .embed import get_provider


def _now():
    return datetime.now(timezone.utc)


def process_document(
    document_id: str, workspace_id: str, filename: str, mime: str, data: bytes
) -> None:
    conn = get_conn()
    try:
        with conn:
            conn.execute(
                "UPDATE ingestion_jobs SET status='running', started_at=%s "
                "WHERE document_id=%s AND workspace_id=%s",
                (_now(), document_id, workspace_id),
            )
            conn.execute(
                "UPDATE documents SET status='parsing' WHERE id=%s AND workspace_id=%s",
                (document_id, workspace_id),
            )

        parsed = extract_text(filename, mime, data)
        chunks = chunk_text(parsed.text, parsed.pages)
        vectors = get_provider().embed([c.text for c in chunks]) if chunks else []

        with conn:
            # Idempotent: re-ingesting a document replaces its chunks.
            conn.execute(
                "DELETE FROM chunks WHERE document_id=%s AND workspace_id=%s",
                (document_id, workspace_id),
            )
            for c, vec in zip(chunks, vectors):
                conn.execute(
                    "INSERT INTO chunks (document_id, workspace_id, ordinal, text, page, "
                    "char_start, char_end, token_count, embedding) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (
                        document_id, workspace_id, c.ordinal, c.text, c.page,
                        c.char_start, c.char_end, c.token_count, vec,
                    ),
                )
            conn.execute(
                "UPDATE documents SET status='indexed', error=NULL WHERE id=%s AND workspace_id=%s",
                (document_id, workspace_id),
            )
            conn.execute(
                "UPDATE ingestion_jobs SET status='done', finished_at=%s "
                "WHERE document_id=%s AND workspace_id=%s",
                (_now(), document_id, workspace_id),
            )
    except Exception as e:  # noqa: BLE001 — record the failure, never crash the worker
        with conn:
            conn.execute(
                "UPDATE documents SET status='failed', error=%s WHERE id=%s AND workspace_id=%s",
                (str(e)[:500], document_id, workspace_id),
            )
            conn.execute(
                "UPDATE ingestion_jobs SET status='failed', error=%s, finished_at=%s "
                "WHERE document_id=%s AND workspace_id=%s",
                (str(e)[:500], _now(), document_id, workspace_id),
            )
    finally:
        conn.close()
```

- [ ] **Step 2: Mount `/ingest` in `engine/app/main.py`** (replace the file)

```python
from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, Depends

from .health import db_ok, models_ok
from .security import require_secret
from .ingest.store import process_document

app = FastAPI(title="CompBrain Engine")


@app.get("/health")
def health():
    return {"status": "ok", "db": db_ok(), "models": models_ok()}


@app.post("/ingest", status_code=202, dependencies=[Depends(require_secret)])
async def ingest(
    background: BackgroundTasks,
    file: UploadFile,
    document_id: str = Form(...),
    workspace_id: str = Form(...),
):
    data = await file.read()
    background.add_task(
        process_document,
        document_id,
        workspace_id,
        file.filename or "upload",
        file.content_type or "application/octet-stream",
        data,
    )
    return {"status": "accepted"}
```

- [ ] **Step 3: Verify the route rejects a bad secret and accepts a good one**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/engine
uv run python -c "
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
r = c.post('/ingest', data={'document_id':'d','workspace_id':'w'}, files={'file':('a.txt','hi','text/plain')})
print('no secret ->', r.status_code)
"
```
Expected: `no secret -> 401`.

- [ ] **Step 4: Commit**

```bash
git add engine/app/ingest/store.py engine/app/main.py
git commit -m "Engine /ingest: secret-guarded upload -> background parse/chunk/embed/store"
```

---

## Task 8: Web engine client + upload/list route + CSRF

**Files:**
- Create: `web/lib/csrf.ts`, `web/lib/engine.ts`, `web/lib/documents.ts`, `web/app/api/documents/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (Plan 1), `saveFile` (T2), `db`+schema (T1), `env` (ENGINE_BASE_URL/ENGINE_INTERNAL_SECRET).
- Produces:
  - `csrf.ts`: `issueCsrf(): Promise<string>` (sets cookie, returns token), `verifyCsrf(req): Promise<boolean>`.
  - `engine.ts`: `ingestDocument(opts: { documentId; workspaceId; filename; mime; data: Buffer }): Promise<void>`.
  - `documents.ts`: `listDocuments(workspaceId: string): Promise<DocumentRow[]>`.
  - `POST /api/documents` (multipart `file`) and `GET /api/documents` (JSON list), both auth + workspace scoped.

- [ ] **Step 1: Create `web/lib/csrf.ts`**

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'

const CSRF_COOKIE = 'cb_csrf'

export async function issueCsrf(): Promise<string> {
  const jar = await cookies()
  let token = jar.get(CSRF_COOKIE)?.value
  if (!token) {
    token = randomBytes(24).toString('base64url')
    jar.set(CSRF_COOKIE, token, {
      httpOnly: false, // readable by the client so it can echo it in the header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
  }
  return token
}

export async function verifyCsrf(req: Request): Promise<boolean> {
  const jar = await cookies()
  const cookieToken = jar.get(CSRF_COOKIE)?.value
  const headerToken = req.headers.get('x-csrf-token')
  return Boolean(cookieToken && headerToken && cookieToken === headerToken)
}
```

- [ ] **Step 2: Create `web/lib/engine.ts`**

```ts
import 'server-only'
import { env } from '@/lib/env'

export async function ingestDocument(opts: {
  documentId: string
  workspaceId: string
  filename: string
  mime: string
  data: Buffer
}): Promise<void> {
  const form = new FormData()
  form.set('document_id', opts.documentId)
  form.set('workspace_id', opts.workspaceId)
  form.set('file', new Blob([opts.data], { type: opts.mime }), opts.filename)
  const res = await fetch(`${env.ENGINE_BASE_URL}/ingest`, {
    method: 'POST',
    headers: { 'x-engine-secret': env.ENGINE_INTERNAL_SECRET },
    body: form,
  })
  if (!res.ok) throw new Error(`engine /ingest responded ${res.status}`)
}
```

- [ ] **Step 3: Create `web/lib/documents.ts`**

```ts
import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { documents } from '@/lib/db/schema'

export type DocumentRow = typeof documents.$inferSelect

export function listDocuments(workspaceId: string): Promise<DocumentRow[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(desc(documents.createdAt))
}
```

- [ ] **Step 4: Create `web/app/api/documents/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { verifyCsrf } from '@/lib/csrf'
import { saveFile } from '@/lib/storage'
import { ingestDocument } from '@/lib/engine'
import { listDocuments } from '@/lib/documents'
import { db } from '@/lib/db/client'
import { documents, ingestionJobs } from '@/lib/db/schema'

export const runtime = 'nodejs'

const ALLOWED = new Map<string, string>([
  ['pdf', 'application/pdf'],
  ['txt', 'text/plain'],
  ['md', 'text/markdown'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
])
const MAX_BYTES = 25 * 1024 * 1024

export async function GET() {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ documents: await listDocuments(auth.workspace.id) })
}

export async function POST(req: Request) {
  const auth = await getCurrentUser()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyCsrf(req))) return NextResponse.json({ error: 'bad csrf' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const mime = ALLOWED.get(ext)
  if (!mime) return NextResponse.json({ error: 'unsupported type' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 400 })

  const data = Buffer.from(await file.arrayBuffer())
  const { storageKey, bytes } = await saveFile(auth.workspace.id, file.name, data)

  const [doc] = await db
    .insert(documents)
    .values({
      workspaceId: auth.workspace.id,
      filename: file.name,
      mime,
      bytes,
      storageKey,
      status: 'uploaded',
    })
    .returning()
  await db.insert(ingestionJobs).values({
    documentId: doc.id,
    workspaceId: auth.workspace.id,
    status: 'queued',
  })

  try {
    await ingestDocument({
      documentId: doc.id,
      workspaceId: auth.workspace.id,
      filename: file.name,
      mime,
      data,
    })
  } catch {
    await db
      .update(documents)
      .set({ status: 'failed', error: 'could not reach ingestion engine' })
      .where(eq(documents.id, doc.id))
    return NextResponse.json({ error: 'ingestion unavailable' }, { status: 502 })
  }
  return NextResponse.json({ document: doc }, { status: 201 })
}
```

Note: add `import { eq } from 'drizzle-orm'` to the route.

- [ ] **Step 5: Typecheck + commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web && npx tsc --noEmit
cd /Users/dovud/Developer/personal/startup/compbrain
git add web/lib/csrf.ts web/lib/engine.ts web/lib/documents.ts web/app/api/documents
git commit -m "Web: upload route (auth + csrf + size/type guards) -> store + engine ingest; documents list"
```

---

## Task 9: Web sources UI (upload + polling)

**Files:**
- Create: `web/app/(app)/dashboard/Sources.tsx`
- Modify: `web/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/documents` (T8), `issueCsrf` (T8).
- Produces: an upload control + a document list that polls `/api/documents` every 2.5s and renders each file's status.

- [ ] **Step 1: Create `web/app/(app)/dashboard/Sources.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Doc = {
  id: string
  filename: string
  status: 'uploaded' | 'parsing' | 'indexed' | 'failed'
  error: string | null
  bytes: number
}

const STATUS_LABEL: Record<Doc['status'], string> = {
  uploaded: 'Queued',
  parsing: 'Indexing…',
  indexed: 'Indexed',
  failed: 'Failed',
}

export function Sources({ csrf }: { csrf: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/documents')
    if (r.ok) setDocs((await r.json()).documents)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 2500)
    return () => clearInterval(t)
  }, [refresh])

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.set('file', file)
        const r = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'x-csrf-token': csrf },
          body,
        })
        if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? 'upload failed')
      }
      await refresh()
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">Sources</h2>
        <label className="cursor-pointer rounded-md bg-ink px-4 py-2 text-body-sm text-paper">
          {busy ? 'Uploading…' : 'Upload documents'}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-body-sm text-sovereign-text">{error}</p>}
      <ul className="mt-4 divide-y divide-line rounded-md border border-line">
        {docs.length === 0 && (
          <li className="px-4 py-6 text-body-sm text-ink-soft">
            No documents yet. Upload PDFs, Word, text, or markdown to build this workspace’s brain.
          </li>
        )}
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between px-4 py-3">
            <span className="truncate text-body text-ink">{d.filename}</span>
            <span
              className={
                d.status === 'indexed'
                  ? 'text-body-sm text-brain-text'
                  : d.status === 'failed'
                    ? 'text-body-sm text-sovereign-text'
                    : 'text-body-sm text-ink-soft'
              }
              title={d.error ?? undefined}
            >
              {STATUS_LABEL[d.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: Render it in `web/app/(app)/dashboard/page.tsx`**

```tsx
import { getCurrentUser } from '@/lib/auth/current-user'
import { issueCsrf } from '@/lib/csrf'
import { Sources } from './Sources'

export const runtime = 'nodejs'

export default async function Dashboard() {
  const auth = await getCurrentUser()
  const csrf = await issueCsrf()
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">
        Welcome{auth?.user.name ? `, ${auth.user.name}` : ''}.
      </h1>
      <p className="mt-2 text-body text-ink-soft">
        Workspace <strong className="text-ink">{auth?.workspace.name}</strong>. Ask arrives in Plan 3.
      </p>
      <Sources csrf={csrf} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + build + commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web && npx tsc --noEmit && npm run build
cd /Users/dovud/Developer/personal/startup/compbrain
git add web/app/(app)/dashboard
git commit -m "Dashboard Sources: upload control + polling document status list"
```

---

## Task 10: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Rebuild engine image and bring the stack up**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
docker compose up -d --build engine db
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" npm --prefix web run db:migrate
```

- [ ] **Step 2: Start web dev (host) pointing at the dockerized engine + db**

Engine has no host port, so for local dev run the engine on the host too, OR expose the engine port temporarily. Simplest for this check: run the engine on the host.
```bash
# terminal A — engine on host
cd engine && DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" \
  ENGINE_INTERNAL_SECRET="dev-engine-secret" uv run uvicorn app.main:app --port 8000
# terminal B — web on host
cd web && DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" \
  SESSION_SECRET="dev-secret-…" ENGINE_BASE_URL="http://localhost:8000" \
  ENGINE_INTERNAL_SECRET="dev-engine-secret" STORAGE_DIR=".storage" npm run dev
```

- [ ] **Step 2 (agent variant): run both in the background and drive with Playwright** — start engine + web backgrounded with the env above, log in as the seeded user, upload a small `.txt` fixture on `/dashboard`, poll until status reads `Indexed`.

- [ ] **Step 3: Assert chunks landed with embeddings**

```bash
docker compose exec -T db psql -U compbrain -d compbrain -c \
"SELECT d.filename, d.status, count(c.id) AS chunks,
        bool_and(c.embedding IS NOT NULL) AS all_embedded
 FROM documents d LEFT JOIN chunks c ON c.document_id=d.id
 GROUP BY d.id, d.filename, d.status;"
```
Expected: the uploaded file shows `status=indexed`, `chunks > 0`, `all_embedded = t`.

- [ ] **Step 4: Assert cross-workspace isolation** — a second workspace sees none of the first's documents via `GET /api/documents` (scoped by `workspace_id`). Verify by querying with a different workspace and expecting `chunks` rows do not leak (the API filters on `auth.workspace.id`).

- [ ] **Step 5: Commit any verification fixtures** (if a fixture file was added under `engine/tests/fixtures/`), else nothing to commit.

---

## Self-Review (against the spec)

**Spec coverage:**
- §3.2 upload → store → job → status UI → Tasks 2, 8, 9. ✓
- §3.3 ingestion parse→chunk→embed→store → Tasks 4–7. ✓
- §5.2 ingest path (async, poll, honest failure) → Tasks 7–9. ✓
- §6 documents/ingestion_jobs/chunks (+vector, workspace_id) → Task 1. ✓
- §7 engine modules + internal-secret guard → Tasks 3–7. ✓
- §8 self-hosted embeddings, config-not-code, no egress → Task 6 (+fake dev fallback, clearly labelled). ✓
- §9 CSRF double-submit (deferred from Plan 1) → Task 8. ✓
- §11 storage volume, EMBED_DIM env → Task 2. ✓

**Placeholder scan:** every code step is complete; no TBD/TODO. ✓
**Type consistency:** `EMBED_DIM`=1024 in schema mirrors engine `embed_dim`=1024; `documents`/`ingestionJobs`/`chunks` column names identical across web schema and engine SQL; `x-engine-secret` / `x-csrf-token` header names consistent between client and server. ✓

**Known limitations (recorded, not blockers):** single-process background worker (no queue); docx has no page granularity (page=1); fake embeddings are non-semantic (real path needs `MODELS_BASE_URL`); scanned/image PDFs extract no text and will index 0 chunks (OCR is a later slice) — the UI shows `indexed` with 0 chunks, which Plan 3's ask will surface as "no sources".

## Next plan (not built here)
- **Plan 3 — Ask & Citations:** engine `/ask` (embed query → pgvector ANN, workspace-scoped → context → LLM answer with citation markers → resolve markers to chunks), `chats`/`messages`/`citations` tables, the ask UI with clickable source passages, and a small retrieval eval.
