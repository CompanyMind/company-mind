# AUDIT — CompanyMind

Full-codebase audit pass, 2026-07-28. Scope: `engine/` (FastAPI, 46 modules),
`web/` (Next 16 BFF + UI, ~120 modules), `marketing/` (public site), root
compose/CI. Read module by module, not just entry points.

**Baseline before any fix**

| Suite | Before | After |
|---|---|---|
| `engine` — `uv run pytest` (no DB, the CI-secretless path) | 155 passed, 60 skipped | 162 passed, 71 skipped |
| `engine` — `uv run pytest` **with** a real Postgres | 215 passed | **233 passed** |
| `web` — `npm test` | 200 passed, 24 skipped | **223 passed**, 31 skipped |
| `web` — `tsc --noEmit` | **44 errors** (B9) | **clean** |
| `web` — `next build` (no env, no DB) | ok | ok |
| `marketing` — `tsc --noEmit` / `next build` | clean / never run in CI | clean / **now in CI** |

The engine's DB-gated tests (60 of them) were being skipped locally for want of a
`DATABASE_URL`. They were run for this audit against the compose Postgres —
several fixes below are only meaningfully verified with a real database, and one
regression guard (A5) was confirmed by reverting the fix and watching the test
fail with the original 25 queries.

Severity: **A** = ship-blocking (security / availability), **B** = real defect
or cost, **C** = hygiene.

---

## A — High

### A1. Path traversal from a route param into the internal engine API — cross-tenant read
**`web/lib/source.ts:21`** (member-reachable) and 12 other call sites.

`getSource` builds `new URL(\`${ENGINE_BASE_URL}/source/${chunkId}\`)` with an
un-encoded, user-supplied `chunkId` taken straight from `/s/[chunkId]`. Next
URL-decodes route params before handing them over, and both `new URL()` and
`fetch()` normalise `..` segments. Verified:

```
new URL('http://engine:8000/source/../usage/summary')
  -> http://engine:8000/usage/summary
```

So `GET /s/..%2Fusage%2Fsummary` — decoded by Next to `../usage/summary` —
reaches **any engine endpoint**, carrying the trusted `x-engine-secret` header
that authorises the whole internal API. The only gate on this page is
`getCurrentUser()`, so **any member of any firm** can read platform-wide
aggregate usage, or another firm's documents / folders / Atlas by appending
`?workspace_id=<other>` (query-string args on the traversed path are honoured —
`resolve_access` trusts the `workspace_id` it is given because the *web* layer
is supposed to be the thing that pins it).

Same class, owner-gated (lower severity — still breaks per-firm isolation for an
owner, who can then reach another firm's data):
`lib/graph.ts` (`getTopic`, `dismissFinding`), `lib/folders.ts` (`renameFolder`,
`deleteFolder`, `setDocumentFolder`), `lib/groups.ts` (`renameGroup`,
`deleteGroup`, `setGroupMembers`, `setDocumentGroups`, `documentGroupIds`),
`lib/telegram.ts` (`setLinkStatus`, `setTelegramLinkGroups`),
`lib/platform/firms.ts` (`bootstrapWorkspace`).

`lib/documents.ts` already does this correctly with `encodeURIComponent` — the
codebase knows the rule and applies it in exactly one of thirteen places.

- [x] **Fixed** — added `enginePath()`/`seg()` in `web/lib/engine-url.ts`; every
  interpolated path segment is now encoded at that one boundary, and
  `lib/documents.ts`'s hand-rolled `encodeURIComponent` was folded onto the same
  helper so there is a single idiom to grep for. New
  `web/lib/engine-path-traversal.test.ts` drives `../usage/summary` through all
  **14** call sites and asserts on the URL `fetch` actually resolves. All 14
  failed before the fix; all 14 pass after.

### A2. Engine holds a pooled DB connection across LLM network calls — pool starvation
**`engine/app/main.py:152` (`/folders/organize`), `:239` (`/suggestions`),
`engine/app/graph/service.py:58` (`build_graph`).**

The codebase states this invariant three times — `retrieve.py`'s three-phase
comment, `prepare.py`'s docstring ("holding one across it starves every ask"),
`firms.ts::createFirm` ("the pool-starvation mistake this codebase has already
paid for twice") — and then violates it in three places:

- `organize_unfiled(conn, …)` runs inside `with get_conn() as conn` and makes one
  chat call per cluster (up to 8, `timeout=60` each) plus `_unique_name`'s query
  loop, all while holding the connection.
- `suggest_questions(conn, …)` likewise, up to 3 sequential chat calls.
- `build_graph` holds one connection for the entire build, including up to 50
  `label_cluster` chat calls.

The pool is `max_size=10`, shared by ask, ingest, the Telegram worker and Atlas.
Three concurrent owners clicking "AI organise" can hold 3 connections for
minutes.

- [x] **Fixed** — all three split into explicit load / call-models / write
  phases that release the connection around the network work, mirroring
  `retrieve.py`: `plan_organize`/`label_plan`/`apply_organize`,
  `visible_folders`/`render_questions`, and `build_graph`'s three phases. The
  original `conn`-taking functions are kept for direct/test callers; `main.py`
  now calls `*_pooled` variants that own their own connections.
  `engine/tests/test_no_conn_across_models.py` stands a probe in for the chat
  client and asserts zero connections are checked out at call time.

  The obvious probe — reading the pool's `pool_size - pool_available` — is
  **racy** and was replaced: psycopg_pool returns a released connection on a
  worker thread, so a reading taken right after a `with` block exits can still
  see it as busy. The `track_checkouts` fixture in `tests/conftest.py` wraps the
  module's own `get_conn` and counts enters/exits instead.

### A3. Telegram worker holds a connection across the whole ask path, re-enters the pool, and blocks the event loop
**`engine/app/bot/worker.py:22-23`.**

```python
with get_conn() as c:
    reply = handle_update(c, bot["workspace_id"], u)
```

`handle_update` calls `answer_query`, which opens **two more** pooled
connections (`resolve_access`, the `query_log` write) and makes an embedding call
plus a chat call (`timeout=120`) in between — all while the outer connection is
still checked out. Three problems in one line:

1. Re-entrant pool acquisition while holding a connection. With enough
   concurrency this is a `PoolTimeout`, not a slowdown.
2. One connection pinned for the full model round-trip — the same starvation as
   A2.
3. `handle_update` is a *sync* function called directly on the asyncio event
   loop, so the worker stops polling **every other workspace's bot** for the
   duration of one person's question.

- [x] **Fixed** — `handler.py` split into `resolve_principal()` (DB only, short
  connection) and `answer_for()` (retrieval + model, no connection held), joined
  by `handle_update_pooled()`. The worker dispatches it via `asyncio.to_thread`
  so one person's 120 s question no longer freezes every other workspace's bot.
  `tests/test_bot_worker.py` covers all three properties, including that the
  handler does not run on the event-loop thread.

### A4. `getSuggestions` documents a fallback it does not have — engine outage 500s the Ask page
**`web/lib/engine.ts:136-151`.**

The docstring says "any failure (network, non-2xx) must fall back to an empty
list rather than break the Ask page", and the non-2xx half is implemented. The
network half is not: there is no `try/catch`, unlike its sibling `generateTitle`
directly above, which has one. A refused connection to the engine rejects out of
`/api/suggestions` as an unhandled 500.

- [x] **Fixed** — wrapped in `try/catch` returning `[]`, matching
  `generateTitle`. Covered by `web/lib/engine-degradation.test.ts`.

### A5. `graph/store.py::load_docs` — N+1 query over the entire audit log
**`engine/app/graph/store.py:59-70`.**

One `SELECT DISTINCT document_id FROM chunks WHERE id = ANY(…)` **per row of
`query_log`**, to compute a single boolean per document ("was this ever
retrieved"). A workspace with 10 000 logged questions issues 10 000 queries per
Atlas build — and `load_docs` is called twice per document-graph request.

- [x] **Fixed** — chunk ids from every log row are unioned first, then resolved
  with one `ANY(%s::uuid[])` query.
  `test_graph_store.py::test_load_docs_resolves_retrieved_docs_in_one_query`
  counts them. **Verified by reverting**: with the original code the same test
  reports 25 lookups for 25 logged questions; with the fix, 1.

---

## B — Medium

### B1. Dead cross-tier admin module, including a non-transactional `createUser`
**`web/lib/auth/admin-users.ts`.**

`createUser`, `listAdminUsers`, `AdminUserRow`, `blockUser`, `unblockUser` have
**zero callers** — leftovers from the cross-firm admin panel the three-tier
split deleted. CLAUDE.md: *"The platform tier manages firms, not people — resist
re-adding a cross-firm create-user route, which is the thing the tier split
exists to remove."* Keeping a working `createUser({workspaceId, role})` in the
tree is that route, one import away.

It is also the only one of the three user-creation paths that is **not
transactional**: `people.ts::createPerson` and `firms.ts::createFirm` both wrap
the user + membership inserts in `db.transaction`; `createUser` does two bare
inserts, so a failure on the second leaves a user with no membership — unable to
log in, with their email permanently taken.

- [x] **Fixed** — deleted `createUser`, `listAdminUsers`, `AdminUserRow`,
  `blockUser`, `unblockUser`. `wouldBlockSelf` (unit-tested, used by
  `people.ts`) and `generateTempPassword` (used by `people.ts` and `firms.ts`)
  remain, with the file's docstring recording why the rest went. Deleting
  `listAdminUsers` also removed one of the two copies of the unscoped `sessions`
  aggregate in B5.

### B2. Login rate-limiter Map never evicts — unbounded memory growth
**`web/lib/auth/rate-limit.ts:5`.**

`hits` keys on `${ip}:${email}`. Entries are filtered *within* a key but a key is
never deleted, so every distinct ip/email pair ever seen is retained for the life
of the process. An attacker rotating the email field grows it without bound; so
does ordinary traffic, more slowly.

- [x] **Fixed** — an amortised sweep (at most once a minute, driven by calls
  rather than a timer, which would hold the event loop open) drops keys whose
  window has fully drained. New `lib/auth/rate-limit.test.ts` covers the limit
  itself, the forgiveness window, per-key independence, and the eviction: 500
  rotated-email keys collapse to 1 after a window passes.

### B3. Redundant per-request `memberships` query for a role the session already carries
**`web/app/api/ask/route.ts:36`, `web/app/(app)/s/[chunkId]/page.tsx:16`.**

Both re-query `memberships` to derive `role`, then pass `mem?.role ?? 'member'`.
`validateSessionToken` already resolved that exact row and put it on
`auth.role` — which `/api/suggestions` and `/api/documents` correctly note and
use. Two extra DB round-trips on the two hottest authenticated paths, and an
inconsistency that reads as if the session's role were untrustworthy.

- [x] **Fixed** — both now read `auth.role`; the Drizzle imports and the
  `db`/`memberships` dependencies they existed only to serve are gone from both
  files.

### B4. `validateSessionToken` — four sequential round-trips per authenticated request
**`web/lib/auth/session-store.ts:34-72`.** `sessions` → `users` → `memberships` →
`workspaces`, each its own `findFirst`, awaited in series, on **every**
authenticated request and every server render. Expressible as one join.

- [x] **Fixed** — collapsed into one joined select (sessions ⋈ users ⋈
  memberships ⋈ workspaces). Safe because `memberships.user_id` is uniquely
  indexed, so the join cannot fan out — the invariant the old `findFirst` with
  no `ORDER BY` was already depending on silently. Every guard is preserved in
  the same order. Verified against a **real database**: the existing
  `auth/suspension.test.ts` (5 tests) still passes, plus a new
  `auth/session-validation.test.ts` (7 tests) covering the branches it did not —
  live principal, unknown token, expiry *and* the row deletion it triggers,
  blocked user, a user with no membership, session isolation, and the
  no-fan-out invariant itself.

### B5. `listPeople` scans every session in the deployment to annotate one firm
**`web/lib/people.ts:39-43`.**

```ts
db.select({...}).from(sessions).groupBy(sessions.userId)   // no WHERE at all
```

Aggregates the whole `sessions` table across every firm, then throws away all
but the current workspace's users in JS. Grows with total platform traffic, not
with firm size.

- [x] **Fixed** — restricted to the workspace's own user ids with `inArray`.
  The second copy of this query, in `listAdminUsers`, was deleted outright in
  B1.

### B6. `retrieve.py::_expand_neighbors` — one query per result
**`engine/app/ask/retrieve.py:86-97`.** A separate `SELECT text FROM chunks …`
per final result — `final_k` = 8 round-trips on the ask path, inside the
latency budget the user is actually waiting on.

- [x] **Fixed** — one query unions every needed `(document_id, ordinal)` window,
  which is exactly what `chunks_doc_ordinal_idx` serves. Neighbour expansion had
  **no test at all**; it now has two — the window contents and ordering, and the
  document-edge case where `ordinal 0` has no predecessor — plus a query count.
  **Verified by reverting**: 2 results cost 2 queries before, 1 after.

### B7. `document_graph` builds a dense n×n similarity matrix
**`engine/app/graph/service.py:180-200`.** `unit @ unit.T` materialises n²
float64 — 10 000 documents is 800 MB, on a request path. `np.argsort(-row)` then
sorts all n per node to take `topk` (5).

- [x] **Fixed (memory only, deliberately)** — the matrix is built in row blocks
  (`EDGE_BLOCK = 512`), so peak memory is `block × n` instead of `n × n`.

  `argpartition` was tried for the top-k and **backed out**: it does not
  preserve stable order across an exact tie at the k-th position, so it can
  select a different neighbour than `argsort` when two documents sit at
  identical cosine — a real output change on a surface people read as evidence.
  The sort is not the cost anyway; the `O(n² · 1024)` matmul dwarfs it. The
  selection is left byte-identical.

  `test_document_graph_blocking_matches_the_dense_reference` runs the same
  inputs through the shipped code and through the original dense implementation
  verbatim and requires identical edges, weights and degrees — with
  `EDGE_BLOCK` forced to 8 over 37 documents so the multi-block path is
  genuinely exercised rather than collapsing to a single dense pass.

### B8. Telegram worker swallows every error and acks messages it never processed
**`engine/app/bot/worker.py:16-33`.** Three bare `except`: `continue`, `reply =
None`, `pass` — no logging in any of them. Worse, `last = max(last, update_id)`
runs **before** `handle_update`, and the offset is committed after the loop, so a
message that raised is permanently acked. A person's question vanishes and there
is no line anywhere saying it did.

- [x] **Fixed** — `logging` throughout, with workspace and update id on every
  failure. `getUpdates` failing no longer advances the offset (nothing was
  consumed). A failing *handler* still does — a poison message must not wedge
  the bot into re-delivering it forever — but the ack now happens **after** the
  attempt, it is logged, and the person gets an apology instead of silence.

### B9. 44 TypeScript errors in `web`, and nothing runs `tsc` there
**`web/lib/{graph-routes,control-plane-gates,chat-isolation,document-download,
auth/require-owner}.test.ts`.**

All 44 are the same defect: a mocked `Session` is built without `sessionId`,
which `session-store.ts` made required. `next build` does not typecheck test
files, `web/package.json` has no `typecheck` script (marketing does), and CI runs
neither — so `tsc` has been red for however long and nothing said so.

- [x] **Fixed** — a shared `fakeSession()`/`fakeOwner()` helper in
  `web/test/session.ts` replaces all five hand-rolled copies, so the next field
  added to `Session` is one edit rather than five. `tsc --noEmit` goes from 44
  errors to 0. Added `"typecheck": "tsc --noEmit"` to `web/package.json` and a
  CI step for it, plus a whole `marketing` job (C7).

### B10. Row-at-a-time inserts on the ingest and Atlas write paths
**`engine/app/ingest/store.py:58-74`** (one INSERT per chunk — a 200-page PDF is
~600 round-trips inside one transaction) and **`graph/store.py::write_build`**
(one per topic member, per doc-meta row, per finding).

- [x] **Fixed** — both use `executemany`, which psycopg3 pipelines. Transaction
  boundaries and row contents unchanged; the existing ingest and Atlas
  round-trip tests cover the result.

### B11. `list_documents` reads the workspace's entire `document_groups` table
**`engine/app/library/documents.py:33-36`.** Unconditional
`SELECT document_id, group_id FROM document_groups WHERE workspace_id=%s`, even
when the listing is one folder or a member sees three files.

- [x] **Fixed** — restricted to the document ids actually being returned, via
  `= ANY(%s::uuid[])`. Covered by the existing `test_library_scoping.py`, which
  asserts the group tags each caller sees.

### B12. `/health` bypasses the pool and makes unauthenticated egress on every hit
**`engine/app/health.py`.** `db_ok` and `embed_dim_ok` each open a fresh
`psycopg.connect` (the pool exists precisely to stop this), and `models_ok` does
`httpx.get(f"{models_base_url}/models")` — on the OpenAI default that is a
request to `api.openai.com` on **every healthcheck**, from a product whose
central claim is that nothing leaves the customer's network. Compose polls it.

- [x] **Fixed** — `db_ok`/`embed_dim_ok` use the pool, and `embed_dim_ok` is
  memoised (the schema cannot change without a migration and a restart; a
  transient failure is deliberately *not* cached, so it retries). `models_ok`
  never probes the hosted default — it reports configuration there (`True` with
  a key, `False` without, `None` under fakes) and probes only a self-hosted
  `MODELS_BASE_URL`, which is inside the customer's network and is the case
  where reachability is a real question. Three tests added to
  `test_no_egress.py`, including one that fails if `psycopg.connect` is called
  at all.

---

## C — Low / hygiene

- [x] **C1.** `telegram/store.py::set_link_status` — the two `UPDATE`s matched on
  `id` alone and ran outside the existence check's transaction, so the workspace
  scoping lived entirely in a `SELECT` taken a moment earlier. Approving a
  Telegram identity grants document access, so the predicate belongs on the
  write: both statements now carry `workspace_id` and share one transaction with
  the check.
- [x] **C2.** `web/app/api/groups/route.ts` — the comment above `POST` claims
  "GET stays member-reachable", but the `GET` right above it is
  `getOwner()`-gated (correctly — it returns a staff directory). Stale comment
  corrected.
- [x] **C3.** `Atlas.tsx::rebuild` ignored the POST's status — a rejected rebuild
  left the button spinning through a poll that would never see a job start — and
  left an untracked `setTimeout` recursion. Now returns early on `!res.ok`, and
  the pending timer is held in a ref and cleared on unmount.
- [x] **C4.** `ingest/chunk.py::_page_for` (not `parse.py` — the Phase 1 note had
  the file wrong) — linear page scan per chunk, O(chunks × pages); a 600-page PDF
  spent ~1.2M comparisons computing page numbers. Now a `bisect` over page
  starts, with the `starts` list hoisted into `chunk_text` so it isn't rebuilt
  per chunk (which would have reintroduced the cost the bisect removes). The
  fallthrough for an offset in no page's range still returns the LAST page,
  exactly as the scan did — that case is unreachable from `chunk_text`, but
  unreachable is not a reason to change what a function returns. Two tests: an
  exhaustive equivalence check against the original scan over five page layouts
  (gaps, empty pages, consecutive empty pages, out-of-range offsets), and an
  end-to-end assertion that real multi-page chunking labels each chunk with the
  page its first word actually sits on.
- [x] **C5.** `marketing/app/api/waitlist/route.ts` — the webhook payload still
  sent `source: 'compbrain-site'`, the retired brand name, into whatever CRM the
  operator wires up. Now `companymind-site`.
- [x] **C6.** Dead exports removed: `lib/platform/firms.ts::countUnattachedUsers`,
  `lib/groups.ts::documentGroupIds` (both zero callers).
- [x] **C7.** CI never built or typechecked `marketing`. Added, together with the
  `web` typecheck step from B9.

---

## Found in Phase 3 (the re-scan), not in Phase 1

### D1. `npm run lint` has been red the whole time, and CI never runs it
`npx eslint .` in `web/` reports **25 errors** across 12 components, all
`react-hooks/set-state-in-effect` — `Recents`, `Sidebar`, `UserMenu`, `AskChat`,
`Sources`, `AccessManager`, `Atlas`, `Findings`, `Integrations`,
`settings/sections/{Account,Data}`, `sources/DocumentList`. Confirmed
pre-existing by stashing every change in this branch and re-running: same 25.

**Not fixed.** Each one is a `useEffect` that calls a loader which calls
`setState` synchronously — the fix is to restructure data loading in twelve
components, and there is no component-level test net behind any of them (the web
suite is `lib/**` only). That is a refactor with real regression risk, not an
audit fix. Deliberately **not** added to CI either: a step that fails on the
first commit teaches everyone to ignore it. Sequence it as its own piece of
work, then add `npm run lint` to CI in the same change that makes it pass.

### D2. Phase 1 named the wrong file for C4
The linear page scan is in `engine/app/ingest/chunk.py`, not `parse.py`. Fixed
in the C4 entry above; noting it because the Phase 1 report is the artefact
someone else would read.

---

## Deliberately NOT fixed

**`engine/app/ask/answer.py` — `_chat_request` has no retry and a 120 s timeout.**
A single flaky model response fails the whole turn. Adding retries changes cost
and latency characteristics on the paid path and needs a product call on budget;
the failure is at least loud and correctly surfaced as a 502.

**`retrieve.py` lexical arm is hardcoded to `'english'`** in both
`to_tsvector` and `plainto_tsquery`, while the product ships UZ/RU. The telemetry
already measures the damage (`lexical_arm_empty`), and `usage.py` reports it.
Fixing it means choosing a per-document language column and re-indexing every
chunk — a migration and a product decision, not an audit fix.

**One Postgres, two logical databases.** Noted in CLAUDE.md as an intentional
deferral; unchanged.

**`login/actions.ts` rate-limit key includes the email**, so an attacker rotating
addresses gets a fresh bucket per address against one IP. Narrowing to IP-only
would let one office NAT lock out a whole firm. The right fix is two buckets
(per-IP and per-account) with different limits — a security-policy decision.

**`checkLoginRate` is per-process.** Correct only for a single instance. A shared
store is a deployment-topology decision, not a code fix.

**`Atlas.tsx` (1023 lines) and `TourProvider.tsx` (646 lines) are god
components.** Real, but splitting them is a refactor with no behavioural test
net behind the canvas rendering; out of scope for a fix-in-place pass.

**`graph/lenses.py::orphan_docs` and `::degrees` are both O(n²) within a cluster
and compute the same pairwise cosines twice** — once each, in two separate
double loops, on top of the similarity work `document_graph` already does.
Vectorising them is straightforward, but they run inside `build_graph`, which is
a background job with no latency budget, so this is cost without a symptom. B7
fixed the one on the request path; this one can wait for a profile that says it
matters.

**`web/lib/auth/rate-limit.ts` is per-process.** Correct for a single instance
only; a second replica doubles everyone's allowance. A shared store is a
deployment-topology decision.

**Engine `/health` still reports `db` by executing a query per poll.** Cheap, and
unlike `embed_dim_ok` the answer genuinely can change between polls — that is
the entire point of a healthcheck. Left as is.
