# CompBrain — internal product app, core-loop design spec

**Date:** 2026-07-18
**Status:** Approved (design). Implementation not started.
**Owner:** Dovud

---

## 0. What this document is

The design for the **first slice of the actual CompBrain product** — the logged-in application, not the marketing site and not a lead CRM. It builds the one loop that *is* the product: a user brings a dataset of documents, the system indexes it on self-hosted models, and the user asks questions and gets answers cited back to the exact source.

Everything here was decided with the founder in a brainstorm on 2026-07-18. The confirmed decisions are in §2; do not re-litigate them without a new decision. The marketing site spec is a sibling: `2026-07-17-compbrain-website-design.md`.

---

## 1. Goal & success criteria

**Goal.** Ship a production-grade vertical slice of the CompBrain product: sign in → upload documents → they are ingested and indexed on your own GPUs → ask a question → receive an answer whose every claim links to the exact passage it came from.

**Done when** a seeded beta user can, against a fresh workspace:
1. Log in with email + password over a secure session.
2. Upload a set of PDF/Word/text/markdown files and watch them reach `indexed`.
3. Ask a natural-language question and get an answer in which each cited `[n]` opens the real source passage in their own uploaded document.
4. All of the above with **zero data leaving the deployment** — models, vectors, and files are self-hosted.

**Explicit non-goals for this slice** — see §4.

---

## 2. Confirmed decisions (the brainstorm outcomes)

| Decision | Choice | Consequence |
|---|---|---|
| What we're building | The **real product app**, core loop first | Not a demo, not a lead admin |
| Models | **Self-hosted from day one** | vLLM on your GPUs, OpenAI-compatible; sovereignty is real, not deferred |
| Access | **Closed beta, invite-only** | Real workspaces + multi-tenant foundations; accounts seeded by script, no public sign-up |
| First dataset types | **Docs: PDF, Word, text, markdown** | Text-extraction pipeline only; audio/images later |
| Architecture | **Split: TS web + Python engine** | `web/` (Next.js) + `engine/` (FastAPI), shared Postgres/pgvector |
| Auth | **Hand-rolled sovereign sessions** (argon2id + DB sessions) | No third-party auth dependency; runs behind the walls too |

Inherited product truth (from the website spec, still binding): audience is **regulated enterprises**; stage is **pre-launch**; the honesty constraints hold (never claim certifications, never fabricate). The app must embody the three pillars: **UNIFY, SOVEREIGN, TRUSTWORTHY**.

---

## 3. In scope (v1 vertical slice)

1. **Auth & workspaces.** Email+password login, secure server sessions, a seed script to create beta users + their workspace, workspace-scoped data isolation, one role model (owner/member — trivial for v1 but present).
2. **Dataset upload.** Upload one or many docs (PDF/docx/txt/md) into a workspace; file stored on a local volume; a per-file `ingestion_job` tracks progress; a dashboard view shows each file's status.
3. **Ingestion pipeline** (engine): parse → chunk (token-aware, overlapping, origin-preserving) → embed (vLLM) → store chunks + vectors in pgvector.
4. **Ask** (engine): embed query → workspace-scoped ANN search → assemble context → LLM answers with citation markers → resolve markers to chunks → return answer + source snippets.
5. **Citations UI.** Answer renders `[n]` markers; each opens the exact source passage (document + page + snippet).
6. **Dashboard shell** in the CompBrain paper/ink brand: sources list, upload, ask/answer view, sign-out.

---

## 4. Explicitly deferred (NOT in v1)

Each is a later slice with its own spec. v1 must leave clean seams for them, but must not build them.

- The **brain graph** visualization (the signature marketing visual).
- **Audio and image** ingestion (transcription, OCR/vision).
- **Connectors** (Slack, email, Google Drive, etc.) — v1 is manual upload only.
- **In-app invites / self-serve sign-up** — v1 seeds accounts by script.
- **Reranking** of retrieved chunks — v1 uses vector similarity only; the engine leaves a `rerank()` seam.
- **Billing, usage metering, admin analytics.**
- **Streaming** token-by-token answers — v1 may return the whole answer; streaming is a later polish.
- A dedicated **queue/broker** (Redis/Celery) — v1 uses an in-engine background worker; swap in a broker when throughput demands.

---

## 5. Architecture

### 5.1 Services

| Service | Tech | Responsibility | Internet-exposed? |
|---|---|---|---|
| `web` | Next.js 16 / TS | Marketing site (as-is) + authed dashboard + **server-only** proxy to engine + auth/session + workspace data | Yes |
| `engine` | FastAPI / Python | Ingest, retrieve, answer. The only service that touches models & vectors. Future on-prem container. | **No** (internal network only) |
| `models` | vLLM on your GPUs | One embedding model + one instruct LLM, OpenAI-compatible API | **No** |
| `db` | Postgres + pgvector | Single datastore: identity + content + vectors | **No** |
| storage | Local volume (MinIO/S3 later) | Uploaded original files | **No** |

The browser talks **only** to `web`. `web` calls `engine` server-side with an internal shared secret and an explicit `workspace_id`. `engine` never trusts the browser and is never reachable from it.

### 5.2 Ingest path

```
browser → web: upload file(s)
web: store file on volume; INSERT document(row, status=uploaded); INSERT ingestion_job(status=queued)
web → engine: POST /ingest { document_id, workspace_id }   (server-side, internal secret)
engine (background worker):
   parse (by filetype) → chunk (token-aware, overlap, keep {document_id, page, char_start, char_end})
   → embed chunks in batches via vLLM embeddings
   → INSERT chunks(text, vector, origin) ; UPDATE document.status=indexed ; job.status=done
web dashboard: polls GET /documents → shows status uploaded → parsing → indexed (or failed)
```

Ingestion is **asynchronous**: upload returns immediately; the worker processes; the UI polls. Failures set `status=failed` with a reason and never silently drop a file.

### 5.3 Ask path

```
browser → web: POST question { chat_id?, text }
web → engine: POST /ask { workspace_id, question, chat_id? }
engine:
   embed(question) → pgvector ANN search WHERE workspace_id=? ORDER BY vector <=> q LIMIT k
   → build context block from top-k chunks (with stable [1..k] labels → chunk ids)
   → LLM answer with a prompt that REQUIRES citing [n] for every claim
   → parse [n] markers; resolve to chunk ids; DROP/repair any marker that doesn't resolve
   → return { answer, citations:[{marker, document_id, page, snippet}] }
web: persist message + citations; render answer with clickable [n] → source passage
```

Retrieval is always `workspace_id`-scoped in the SQL itself — tenant isolation cannot be forgotten at the app layer because it is in the query predicate.

---

## 6. Data model (Postgres)

All content tables carry `workspace_id` and every content query filters on it.

- **`users`** — `id`, `email` (unique, citext), `password_hash` (argon2id), `name`, `created_at`.
- **`workspaces`** — `id`, `name`, `slug`, `created_at`.
- **`memberships`** — `user_id`, `workspace_id`, `role` (`owner`|`member`), unique(user, workspace).
- **`sessions`** — `id` (opaque token, hashed at rest), `user_id`, `expires_at`, `created_at`, `user_agent`, `ip`.
- **`documents`** — `id`, `workspace_id`, `filename`, `mime`, `bytes`, `storage_key`, `status` (`uploaded`|`parsing`|`indexed`|`failed`), `error`, `created_at`.
- **`ingestion_jobs`** — `id`, `document_id`, `workspace_id`, `status`, `error`, `started_at`, `finished_at`.
- **`chunks`** — `id`, `document_id`, `workspace_id`, `ordinal`, `text`, `page`, `char_start`, `char_end`, `token_count`, `embedding vector(D)`. Index: `ivfflat`/`hnsw` on `embedding` (cosine).
- **`chats`** — `id`, `workspace_id`, `user_id`, `title`, `created_at`.
- **`messages`** — `id`, `chat_id`, `workspace_id`, `role` (`user`|`assistant`), `content`, `created_at`.
- **`citations`** — `id`, `message_id`, `chunk_id`, `marker` (the `[n]`), `document_id`, `page`, `snippet`.

`D` (embedding dimension) is fixed by the chosen embedding model and pinned in config + migration.

---

## 7. The engine (FastAPI)

**Internal endpoints** (called only by `web`, guarded by shared secret):
- `POST /ingest` `{ document_id, workspace_id }` → enqueues background ingestion; `202`.
- `GET  /health` → readiness (db + model server reachable).
- `POST /ask` `{ workspace_id, question, chat_id? }` → `{ answer, citations[] }`.

**Pipeline modules** (each independently testable):
- `parse/` — one extractor per filetype (PDF, docx, txt, md) → normalized text + page/offset map.
- `chunk/` — token-aware splitter (~500–800 tokens, ~12% overlap) preserving `{page, char_start, char_end}`.
- `embed/` — batched calls to the vLLM embeddings endpoint; ret/backoff; returns `vector(D)`.
- `store/` — writes chunks+vectors; idempotent per `document_id` (re-ingest replaces).
- `retrieve/` — query embed + pgvector ANN, workspace-scoped; leaves a `rerank()` seam (no-op in v1).
- `answer/` — prompt assembly + LLM call + **citation resolution/repair** (answers whose markers don't resolve are repaired or the marker is dropped; a claim never ships with a dangling citation).

**Models client** — a thin OpenAI-compatible client pointed at the vLLM base URL. Embedding model and LLM are **config**, not code (`EMBED_MODEL`, `LLM_MODEL`, `MODELS_BASE_URL`). Swapping a checkpoint is an env change.

---

## 8. Models (self-hosted)

vLLM (or equivalent) serves, behind one OpenAI-compatible endpoint on your GPU host:
- an **open embedding model** (BGE-M3 / Qwen-embedding class — founder picks the checkpoint; dimension `D` pinned to it), and
- an **open instruct LLM** sized to the GPU (roughly 7–32B).

The engine treats them as any OpenAI-compatible provider, so the same code path runs against your lab GPUs now and inside a customer's walls later. No model weights or inference calls ever leave the deployment.

---

## 9. Auth & security

- **Passwords:** argon2id, per-user salt, sane cost params.
- **Sessions:** opaque random token in an **HttpOnly, Secure, SameSite=Lax** cookie; only a hash of the token is stored in `sessions`; sliding expiry with an absolute cap.
- **CSRF:** SameSite=Lax + a double-submit token on state-changing routes.
- **Login throttling:** per-IP + per-account rate limit with backoff to blunt credential stuffing.
- **Account creation:** **seed script only** (reads emails/initial passwords from env or prompts), which creates the user, workspace, and owner membership. No public registration route exists in v1.
- **Engine trust boundary:** engine is not internet-exposed; `web`→`engine` calls carry an internal shared secret and an explicit `workspace_id`; engine authorizes nothing from the browser.
- **Secrets:** never committed; read from env at runtime; no `NEXT_PUBLIC_*` secret ever. `.env.example` documents the names.
- **Sovereignty:** no third-party auth, analytics, model, or vector service. Consistent with the on-prem promise.

---

## 10. Web app (dashboard)

- **Routing:** the marketing site stays under its current routes; the app lives under an authed segment (e.g. `app/(app)/…`) gated by session middleware that redirects unauthenticated users to `/login`.
- **Screens (v1):** `login` · `sources` (list + upload + per-file status) · `ask` (question box, answer with clickable citations, source-passage panel) · sign-out.
- **Brand:** same paper/ink system as the marketing site (`--paper`, `--ink`, `--brain` teal, `--query` orange), but calmer and more utilitarian — it's a tool, not a poster. Reuse the tokens; do not fork the palette.
- **BFF:** all engine access is through Next.js server routes/actions; the engine base URL and secret are server-only env.

---

## 11. Deployment

- **`docker-compose`** on your own box: `web`, `engine`, `db` (postgres+pgvector), and the `models` server on one internal network; only `web` publishes a port.
- **Migrations:** Drizzle (web-owned schema) run on deploy; pgvector extension enabled in an init migration.
- **Files:** local Docker volume in v1; MinIO/S3-compatible when object-store semantics are wanted.
- **Env/secrets:** `.env.example` lists every var (DB URL, `ENGINE_INTERNAL_SECRET`, `MODELS_BASE_URL`, `EMBED_MODEL`, `LLM_MODEL`, session secret). Real values live in the host environment.
- The public marketing site may later move to a separate host; the app + engine + db + models stay together.

---

## 12. Testing

- **Unit:** chunker (offsets/overlap correctness), citation resolver (dangling-marker repair/drop), password hashing/session issue+verify.
- **Integration:** full loop against a tiny fixture corpus with the model server stubbed by an OpenAI-compatible fake — upload → indexed → ask → answer with resolvable citations.
- **Retrieval eval (small):** a handful of question→expected-source pairs over the fixture corpus, asserting the right chunk is retrieved top-k. This is internal QA (leaning on the founder's evals strength), **not** a product.
- **Security checks:** unauthenticated access to app routes redirects; engine rejects calls without the internal secret; cross-workspace read returns nothing.

---

## 13. Build order (each step leaves something runnable)

1. **Scaffold.** Repo restructure → `web/` + `engine/`; docker-compose with postgres+pgvector + a stub models service; health checks green.
2. **Auth.** Users/workspaces/sessions schema + migrations; argon2id + sessions; login page + middleware; **seed script**. → You can log in.
3. **Upload.** File storage + `documents` + `ingestion_jobs` + sources UI with polling. → Files land and show status (no indexing yet).
4. **Ingest.** Engine parse → chunk → embed → store; wire `/ingest`; status reaches `indexed`. → The dataset gets indexed.
5. **Ask.** Engine retrieve → answer → citation resolution; `/ask`; ask UI with clickable citations. → The loop closes.
6. **Polish.** Dashboard brand pass; full-loop integration test + retrieval eval; docs/README for running it.

---

## 14. Risks & open questions

- **Ingestion latency / long files** — v1's in-engine worker is single-process; large corpora will be slow. Acceptable for beta; the queue seam (§4) is where we scale.
- **Parsing fidelity** — messy PDFs (scans, multi-column) degrade extraction; scanned PDFs need OCR, which is deferred with images. v1 targets text-extractable docs and marks the rest `failed` honestly.
- **Embedding dimension lock-in** — changing the embedding model changes `D` and requires re-embedding; pinned in config + migration to make the cost explicit.
- **Exact model checkpoints** — founder to pick embedding + LLM checkpoints; defaults wired, swap is config-only.
- **Where `web` runs** — same box as engine for v1 (simplest, most sovereign); revisit if the public marketing site should live on a CDN host separately.

---

## 15. Out-of-scope reminder

Not in this project: brain graph, audio/image ingestion, connectors, invites/self-serve, reranking, billing, streaming, external queue. Listed here so scope creep is visible.
