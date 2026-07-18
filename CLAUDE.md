# CLAUDE.md — CompanyMind

On-premise, permission-aware knowledge platform for regulated enterprises. Core loop:
**sign in → upload documents → ingest/index on self-hosted models → ask → cited answer.**
Every answer traces to its source; nothing leaves the customer's infrastructure.

Brand is **CompanyMind** (never "CompBrain" — old name; some infra IDs like the Postgres
user/db `compbrain` are intentionally left unchanged).

## Architecture — three deployables

The service boundary is drawn on **domain, not language**. Full spec + migration steps:
`docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`.

- **`web/`** — Next.js 16 (App Router, React 19, Tailwind v3). The auth-gated product:
  BFF + UI. Owns the **auth DB** (users, sessions, memberships, workspaces) via Drizzle.
- **`engine/`** — FastAPI, Python 3.12, `uv`. The knowledge domain service: parse → chunk
  → embed → permission-aware retrieval → answer, plus the Telegram bot worker. Owns the
  **knowledge DB** (documents, chunks, groups, query log, telegram). Never internet-exposed.
- **`marketing/`** — separate public Next app. Stateless. **Never ships on-prem.** Don't
  add product code to it or import across the `web/`↔`marketing/` boundary.

Root `docker-compose.yml` runs: `db` (pgvector/pg16), `engine`, `bot`, `web`, `marketing`.

## Migration status (strangler)

The domain-vs-delivery re-architecture is essentially complete:
- **Step 0** — marketing split into its own deployable ✅
- **Step 1** — the access rule lives once, in the engine (`engine/app/access.py::resolve_access`),
  used by ask + the source viewer ✅
- **Step 2** — web is a **BFF**: `web/lib/{documents,groups,source,telegram}.ts` and the
  knowledge API routes call engine endpoints, never Drizzle. The engine owns all
  knowledge-table access (`engine/app/library/*`, `ask/service.py`). **One Postgres kept by
  decision** (no physical DB split) — web still owns the auth tables + `chats/messages/citations`
  and defines the schema in Drizzle; only the engine reads/writes the knowledge tables ✅
- **Step 3** — Telegram is an engine API client; one ask path (`ask/service.py::answer_query`) ✅
- **Step 4** — connection pool + `EMBED_DIM` drift check ✅

Only intentionally deferred: the physical two-database split (contradicts the single-Postgres
lesson), IDF/age-decay retrieval scorers, and the agentic planner/MCP surfaces.

## Conventions & invariants

- **Auth is sovereign, hand-rolled on purpose:** argon2id (`@node-rs/argon2`); session
  tokens stored as sha256 hashes (never the token); HttpOnly/SameSite=Lax cookies;
  seed-only accounts. Don't swap in a third-party auth lib.
- **CSRF** is a session-bound HMAC token — no cookie write during render (Next forbids it).
- **Models**: self-hosted via an OpenAI-compatible endpoint (`MODELS_BASE_URL`). When
  unset, **deterministic fake** embedding/chat providers kick in so the pipeline is fully
  testable with no GPU. `EMBED_DIM=1024` is pinned in `web/lib/db/schema.ts` AND
  `engine/app/settings.py` — changing it means re-embedding every chunk.
- **Access model**: access groups; documents tagged with groups; a person's answer is the
  intersection of their groups; **owners bypass** (all_access). Telegram identities are
  principals too. Aim: one predicate, reused by every surface.
- **Telegram**: one bot per workspace, token encrypted at rest with Fernet; long-polling
  worker (outbound only); admin approves users + assigns groups; ask-only replies with
  citation links to `/s/[chunkId]`.

## Gotchas (bugs already paid for — don't reintroduce)

- **psycopg3**: use `with conn.transaction()`, NOT `with conn:` — the connection context
  manager COMMITS AND CLOSES the connection in psycopg3. Insert vectors via `%s::vector`.
- **Next build needs no DB**: `web/lib/db/client.ts` (lazy Proxy) and `web/lib/env.ts`
  (getter-based) exist so `next build` runs with no env. Keep them lazy.
- `server-only` throws under vitest/tsx — tests alias it to an empty stub; seed scripts
  avoid importing server-only modules.
- Telegram links only render as tappable in Telegram when `APP_URL` is a real public URL
  (localhost won't). A cloudflared quick tunnel is used in dev.

## Commands

```bash
# web (from web/)
npm run dev            # localhost:3000
npm run build          # prod build + typecheck
npm test               # vitest
npm run db:migrate     # drizzle-kit migrate     (needs DATABASE_URL)
npm run seed           # seed accounts

# engine (from engine/)
uv run pytest          # tests (fake providers, no GPU)
uv run uvicorn app.main:app --reload
uv run python -m app.bot.worker    # Telegram long-poll worker
```

## How to work here

Substantial work goes through the superpowers flow: **brainstorming → writing-plans →
executing-plans → finishing-a-development-branch**. Specs live in
`docs/superpowers/specs/`, plans in `docs/superpowers/plans/`. Branch for real changes;
commit in small, verified steps.

**Log every notable change in `CHANGELOG.md`** — Keep a Changelog format, under the
`[Unreleased]` section, grouped by Added / Changed / Fixed / Removed. Add the entry in the
same commit as the change. On a release, rename `[Unreleased]` to the new version + date
(SemVer) and start a fresh `[Unreleased]`.
