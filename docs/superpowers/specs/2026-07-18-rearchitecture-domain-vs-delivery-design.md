# Re-architecture: domain-vs-delivery seam

**Date:** 2026-07-18
**Status:** Approved (shape + two forks). Awaiting spec review before execution.
**Decision forks (locked):** two databases / two owners · incremental strangler migration.

## Why

The code quality is fine — small, single-purpose files; correct auth; thoughtful lazy
DB/env. The problem is **where the service boundary falls: on language (TypeScript vs
Python), not on domain.** That produces three concrete faults:

1. **Two unrelated products share one deployable.** `web/` holds both the public
   marketing site (`app/(marketing)`, `components/scenes/*`, `lib/swarm/*` — a 968-line
   particle-animation engine, the largest file in the repo, product-irrelevant, plus
   `content/*` marketing copy) and the auth-gated product (`app/(app)`, auth, ingestion,
   ask). For an **on-prem product shipped into a regulated customer's datacenter**, this
   ships the marketing site and pricing copy into an air-gapped environment. Opposite
   security posture, deploy target, and change cadence — must be separate deployables.

2. **The access rule is authored twice, in two languages.** "Who may see which document"
   lives in both `web/lib/groups.ts` (`resolveAccess`) and `engine/app/ask/retrieve.py`
   (the SQL predicate). Hand-synced forever, or a restricted document leaks. A permission
   rule must have exactly one implementation.

3. **Postgres is a shared "integration database."** Web (Drizzle/TS) and engine (raw
   SQL/Python) both read *and write* `documents`, `chunks`, `query_log`, `citations`.
   Schema is defined in Drizzle, consumed by hand-typed SQL column lists in Python; no
   compiler catches drift; `EMBED_DIM=1024` is pinned in three places. Three writers
   (web API, engine, Telegram handler); the Telegram handler re-implements the whole
   ask-and-log path with its own `INSERT`.

## Target architecture

Redraw the seam on **domain vs delivery**.

```
   Web UI (Next BFF) ─┐
   Telegram bot ──────┼─▶  KNOWLEDGE ENGINE (Python, FastAPI)      ─▶  Knowledge DB
   MCP / API (later) ─┘    sole owner of the knowledge domain          (ONE owner)

   Web auth (Next) ───────────────────────────────────────────────▶  Auth DB
                                                                       (ONE owner)

   Marketing site  ── separate deployable, never ships to a customer datacenter
```

Two bounded contexts, each with exactly one owner. No shared tables.

### Ownership

**Auth DB — owned by `web/` (TypeScript, Drizzle):**
`users`, `sessions`, `memberships`, `workspaces`.
Rationale: these are facts about *people and tenancy*. Keeps the working argon2id /
opaque-token auth exactly as-is (zero throwaway).

**Knowledge DB — owned by `engine/` (Python):**
`documents`, `ingestion_jobs`, `chunks`, `chats`, `messages`, `citations`, `query_log`,
`groups`, `group_members`, `document_groups`, `telegram_bots`, `telegram_links`.
Rationale: these are facts about *knowledge and its access control*. Everything the
answering pipeline needs is on one side of the wire.

### The principal abstraction (how two DBs stay decoupled)

The knowledge DB must gate access by *who is asking*, but it must not hold a foreign key
into a `users` table it does not own. So the engine identifies callers by an **opaque
principal**, never by an auth-DB row:

- `principal_id: uuid` — the web user's id, or a telegram identity's id. Opaque to the
  engine; no FK.
- `principal_kind: 'user' | 'telegram'`.
- `principal_role: 'owner' | 'member'` — supplied by web from its `memberships` table.

`workspace_id` is likewise an **opaque tenant key** in the knowledge DB (no FK to
`workspaces`, which web owns). This is standard multi-tenant decoupling.

`group_members` is keyed by `(workspace_id, group_id, principal_id, principal_kind)` — no
cross-DB FK. Telegram identities are principals too, so `telegram_bots`/`telegram_links`
live in the engine (the bot worker already does).

### The single access rule (fault #2, resolved)

`resolveAccess` **moves entirely into the engine** and disappears from TypeScript. Every
knowledge call carries the authenticated `{workspace_id, principal_id, principal_kind,
principal_role}`. The engine computes access in one place:

```
if principal_role == 'owner':  all_access = True
else:                          group_ids = resolve_groups(workspace_id, principal_id)
```

and applies the one SQL predicate it already has. Web contributes only the *authenticated
identity and role* (its legitimate bounded context); it never computes group membership.

### Web as a BFF (fault #3, resolved)

Web runs **no raw SQL against knowledge tables.** Everything currently in `chat.ts`,
`source.ts`, `documents.ts`, `groups.ts` (knowledge portions), the `/s/[chunkId]` viewer
query, and the Sources/Access/Integrations management writes becomes an **engine API
call**. After this, Postgres is no longer shared: the knowledge tables are dropped from
web's Drizzle schema and the migrations move to the engine.

### Telegram as an API client (fault #3, resolved)

The bot worker stops importing `retrieve`/`answer`/`store` and stops writing `query_log`
directly. It calls the engine's internal `/ask` with a telegram principal. One ask path,
used by web, Telegram, and any future MCP/speech surface.

## Target repo layout

```
compbrain/
  marketing/          # split out of web/: (marketing) routes, scenes, swarm, content
  web/                # product BFF + UI + Auth DB (users/sessions/memberships/workspaces)
  engine/             # Knowledge domain service + Knowledge DB + bot worker
  docker-compose.yml  # db-auth, db-knowledge (or one pg, two DBs), engine, web, bot
```

## Engine API surface (delivery-agnostic contract)

All internal, `x-engine-secret`-authenticated. Every call carries the principal context.

- `POST /ingest` — (exists) upload → parse/chunk/embed/store.
- `POST /ask` — `{workspace_id, principal, question}` → answer + citations. Engine
  resolves access internally.
- `GET  /documents`, `GET /documents/{id}` — list / status (was `documents.ts`).
- `GET  /source/{chunk_id}` — permission-checked highlighted source (was `source.ts`).
- `GET/POST /groups`, `POST /groups/{id}/members`, `POST /documents/{id}/groups` —
  access management (was `groups.ts` writes + the API routes).
- `GET /telegram/status`, `POST /telegram/connect|disconnect`, `GET /telegram/links`,
  `POST /telegram/links/{id}` (approve + assign groups) — (partly exists).

Web keeps thin route handlers that authenticate the session, derive the principal, and
proxy to these. Contract types shared via one generated/typed source (kill the hand-typed
column lists).

## Migration plan (strangler — each step ships working)

**Step 0 — Split marketing out.** Move `(marketing)` routes, `components/scenes/*`,
`components` used only by marketing, `lib/swarm/*`, `content/*` into `marketing/` with its
own `package.json` and deploy target. Product `web/` sheds ~half its files. No product
behavior change. *Lowest risk, biggest mess reduction — do first.*

**Step 1 — Engine owns the access rule.** Move `resolveAccess` into the engine; `/ask`
takes the principal context; delete TS group resolution. Turn access-management writes
(`setDocumentGroups`, `setGroupMembers`, `setTelegramLinkGroups`) into engine endpoints
that web calls. Removes fault #2.

**Step 2 — Web stops touching knowledge tables.** Move `chat.ts`, `source.ts`,
`documents.ts` (knowledge reads/writes) and the viewer/Sources queries behind engine API.
Drop knowledge tables from web's Drizzle schema; move their migrations to the engine;
split Postgres into auth DB + knowledge DB. Removes fault #3 (shared DB).

**Step 3 — Telegram becomes an API client.** Bot worker calls engine `/ask` instead of
importing the pipeline and writing `query_log`. One ask path.

**Step 4 — Hardening.** Engine connection pool (`psycopg_pool`) instead of connect-per-
call; `EMBED_DIM` single source; engine owns its migrations (alembic or plain SQL);
shared contract types.

## Non-goals

- No rewrite of the working argon2/session auth (it stays in TS, web-owned).
- No change to the ML pipeline internals (parse/chunk/embed/answer) beyond who calls them.
- No new product features — this is purely structural.
- Speech/MCP surfaces are future work; the architecture makes them additive.

## Success criteria

- The access predicate exists in exactly one place (engine).
- No table is written by more than one service.
- Marketing builds and deploys with zero product code, and vice versa.
- Adding a new surface (MCP) requires zero changes to permission logic.
- Each migration step merges independently with the product working.
