# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Brain Map **interactive focus + category filter**: the legend is now a filter — click a
  department to isolate its nodes (the rest dim, the chip gets a pill, a "Showing X" hint
  appears). Hovering or selecting a node lights it and its connected neighbors while dimming
  everything else, and shows a tooltip ("‹document› · N connections · ‹department›") glued to
  the node. Node clicks follow a two-step model like the reference map: first click selects
  (persistent ring + tooltip), a second click on the selected node opens it in Sources.
- Chat history backend: per-user, multi-conversation Ask threads. `chats` gained
  `updatedAt`; `web/lib/chat.ts` now exposes `listChats` (with optional title/message
  search), `createChat`, `chatOwned`, `getChatMessages`, `renameChat`, `deleteChat`, all
  scoped to `(workspaceId, userId)` so a user can only ever see/touch their own chats.
  New routes `GET/POST /api/chats` and `GET/PATCH/DELETE /api/chats/[id]`.
  `POST /api/ask` now takes `{question, chatId?}`, verifies ownership of an existing
  chat or starts a new one, and returns `{message, chatId, title}`. Engine gained
  `POST /title` (`engine/app/ask/title.py::generate_title`) for a smart 3-6 word LLM
  chat title on the first turn, with a deterministic truncation fallback (fake
  providers, or on any engine error) so title generation never blocks a turn.
- Chat history frontend: the Ask page is now a Claude.ai-style two-pane workspace.
  `web/app/(app)/dashboard/AskWorkspace.tsx` owns `selectedChatId` and renders a new
  `Conversations.tsx` sidebar (new-chat button, debounced search, newest-first list,
  inline rename, delete with reselect-newest-or-empty) beside the rewritten `AskChat.tsx`
  (now driven by `{csrf, chatId, onFirstMessage}` props instead of a single fixed
  thread). The sidebar collapses under a slide-over toggle on mobile.
- Brain Map **Obsidian-style document graph** — a document-level knowledge map where each
  node is a document colored by its department (access group), connected by embedding
  **similarity edges** (`GET /api/graph/documents`, backed by a kNN over doc vectors with
  `graph_edge_threshold` / `graph_edge_topk` settings). Tuned d3-force layout (charge +
  x/y gravity + collision) fills the canvas and keeps low-degree docs gathered; a
  **search** box dims everything but filename matches; hovering a node focuses it and its
  neighbors; labels fade in by zoom / hover / hub degree; a **department legend** keys the
  colors. Governance lens toggles recolor nodes over the department palette (e.g. Exposure
  turns the two over-shared docs hot-orange). Clicking a node deep-links to its Sources
  group editor. (Requires `d3-force` as a direct web dependency.)
- Brain Map — owner-only permission-aware governance graph (topic clusters → documents)
  with permission-anomaly / over-exposure / orphan / dead-stale lenses, view-as-group
  audit, and deep-link fixes.
- Brain Map owner page (`web/app/(app)/dashboard/brain-map/`): a 2D topic map rendered
  with `react-force-graph-2d` (dynamically imported with `ssr: false` — the renderer
  touches `window`/`document` at import time), nodes pinned at their stored PCA layout
  and sized by document count, a **Rebuild map** action that polls `/api/graph` off the
  freshly-fetched job status (not a stale closure) until the job leaves `running`, an "as
  of &lt;time&gt;" freshness label, and a **View as** group selector reusing the owner-only
  `getOwner()`/`as_group` plumbing. Clicking a topic drills into that topic's documents
  via `GET /api/graph/topic/[id]` (force-simulated, since only topics carry a stored PCA
  layout); a toolbar of **lens toggles** (Anomaly / Exposure / Orphan / Dead-Stale) colors
  the drilled-in document nodes by the selected governance lens — anomaly and dead/stale
  from findings matched by document id, exposure from the document's exposure score,
  orphan from its orphan flag — and filters the Findings sidebar to the same lens. A
  `Findings` sidebar groups permission-anomaly / over-exposure / orphan / dead / stale
  findings by kind with a **Fix** link to `/dashboard/sources?doc=<id>` and a **Dismiss**
  action, both CSRF-guarded.
- Brain Map web API routes: `GET /api/graph`, `GET /api/graph/topic/[id]`,
  `GET /api/graph/findings`, `POST /api/graph/rebuild`, `POST /api/graph/findings/[id]/dismiss`.
  All owner-gated via new `web/lib/auth/require-owner.ts::getOwner()` (reads role from the
  `memberships` table — the graph is an owner-only governance surface; the owner always
  queries the engine as role `'owner'`, `as_group` drives the "view as" filter). Mutating
  routes also require a valid CSRF token.
- Brain Map engine build/read logic (`engine/app/graph/*`), persisted to five new
  Drizzle-defined tables — `graph_build_jobs`, `graph_topics`, `graph_topic_members`,
  `graph_doc_meta`, `graph_findings`. `build_graph` runs a CPU-only, deterministic
  pipeline — mean-embed each document's chunks → KMeans cluster → TF-IDF keywords per
  cluster → LLM label (or a keyword fallback when `use_real_models()` is false) → PCA
  layout — then computes the four governance lenses (permission-anomaly via per-cluster
  consensus Jaccard, over-exposure via an exposure-score threshold, orphan via low
  max-cosine-similarity, dead/stale via never-retrieved or document age) and persists
  everything inside one connection; a
  `graph_build_jobs` row tracks running/done/failed with `started_at`/`finished_at`/
  `error` so the UI can poll. `get_graph`/`get_topic`/`list_findings`/`dismiss_finding`
  are permission-filtered reads via a new `_visible` helper: the owner sees the whole
  workspace, and a simulated `as_group` sees documents tagged with that group **or** the
  workspace's default Everyone group — matching `engine/app/access.py::resolve_access`
  (a real member sees their groups plus Everyone), not the named group alone. Topic
  labeling reuses a new `engine/app/ask/answer.py::get_chat_call()` seam (extracted from
  `_llm_answer`'s Bearer/httpx call, `None` when `use_real_models()` is false) so the
  fake-provider path stays GPU-free.
- Engine connection **pool** (`psycopg-pool`) replaces connect-per-call across ask, ingest, and the bot worker. `/health` now reports `embed_dim` and an `embed_dim_ok` drift check (the DB's `vector(N)` column is the source of truth for embedding width).
- Brand logo — the "layered vault" mark (nested walls + violet `#684BFF` core).
  `public/logo.svg` (exact mark) in both apps, plus a theme-adaptive `app/icon.svg`
  favicon whose walls flip to paper on dark browser chrome so the mark never disappears.
  A teal `#0f8a7e` variant lives at `web/public/logo-teal.svg`.
- `marketing/` as a standalone Next app — the public site is now a separate deployable
  that never ships to a customer datacenter.
- Project `CLAUDE.md` and this `CHANGELOG.md`.
- Re-architecture spec: draw the service boundary on domain (knowledge vs auth), not
  language — `docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`.
- Brain Map **document-level graph** (`GET /graph/documents` in the engine, `GET
  /api/graph/documents` in web, `web/lib/graph.ts::getDocumentGraph`): an Obsidian-style
  view with every visible document as a node — `department` (its first non-default
  group, alphabetically, else "Everyone"), `exposure_score`/`is_orphan` from
  `graph_doc_meta`, `degree` — connected by undirected cosine-similarity kNN edges over
  the same mean chunk vectors the topic clustering uses (`graph_edge_topk=5` neighbors,
  `graph_edge_threshold=0.35` minimum cosine, both new `Settings` fields). Reuses
  `store.load_docs`/`service._visible` for permission filtering and a new
  `store.group_names` helper for department resolution.

### Changed
- **Web is now a BFF** (Step 2). `web/lib/{documents,groups,source,telegram}.ts` and the knowledge API routes call engine endpoints instead of Drizzle; the engine owns all knowledge-table access (new `engine/app/library/*`, `access.py`, and /documents, /source, /groups, /telegram endpoints). One Postgres kept by decision (no physical DB split); web keeps the auth tables + chat transcript and still defines the schema.
- **One ask path** for every surface. New engine `ask/service.py::answer_query` does retrieval → answer → audit-log; the web `/ask` endpoint and the Telegram handler both call it. The engine now owns the `query_log` write (web passes the principal `user_id` and no longer logs it itself); Telegram stops re-implementing the pipeline.
- Brand accent switched from teal to **electric violet**. `--brain` → `#684bff`,
  `--brain-text` → `#5636d6` (WCAG-recomputed: 4.49–4.90 UI, 5.57+ AA text). Propagated
  across both apps' `tokens.css`, the OG image, and the swarm palette fallback; Tailwind
  `brain` classes and the runtime swarm pick it up from the token automatically.
- Retrieval is now a **hybrid pipeline**: dense (pgvector) + Postgres full-text (GIN), fused
  with **reciprocal rank fusion**, per-document capped, **reranked** (LLM by default, or a
  self-hosted cross-encoder via `RERANK_BASE_URL`), then **neighbor-expanded** (adjacent
  chunks added to the answer context; citations still resolve to the matched span). Chunks are
  embedded with a **contextual header** (`CONTEXTUAL_MODE`). Both retrievers share one
  permission predicate. Adapted from Cerebras's knowledge-base architecture — Postgres-only,
  no Qdrant.
- Chunking is now **300 words per chunk with 50 words of overlap** (was 120/20). Params
  renamed to `target_words` / `overlap_words` since they count whitespace words, not tokens.
- Default model provider is now **OpenAI's API** — LLM `gpt-5.4-nano-2026-03-17`,
  embeddings `text-embedding-3-small` at 1024 dims (via the `dimensions` param). Added an
  `OPENAI_API_KEY` (Bearer) setting. The deterministic fake providers now gate on
  credentials, so tests and offline dev still fall back to them. On-prem deployments
  override `MODELS_BASE_URL` with a self-hosted endpoint so nothing leaves their network.
- Slimmed `web/` to the product only: new minimal root layout, product-scoped `globals.css`.
- Trimmed the root README to essentials.
- Renamed the design-reference folder `CompBrain Company Website/` → `reference/`.

### Removed
- Marketing code (routes, components, `lib/swarm`, `content`, hooks, SEO shell) from `web/`.
- Unused `web/` deps: `clsx`, `lenis`, `tailwind-merge`.
- Marketing's dynamic `app/icon.tsx` (replaced by the static `icon.svg`).

### Fixed
- Brain Map: the over-exposure lens now actually produces findings. `build_graph`
  previously computed `exposure_score` only for the map's heat coloring; a new
  `engine/app/graph/lenses.py::over_exposure_findings()` flags docs at/above a new
  `graph_overexposed_threshold` setting (default `0.5`) as `over_exposure` findings, so
  the Findings sidebar's "Over-exposed" group and the map's Exposure lens filter are no
  longer always empty.
- Brain Map: closed a rebuild-poll race where `POST /graph/rebuild` returned before the
  backgrounded `build_graph`'s own `start_job` ran, so the client's first poll could see
  the *previous* job (or null on a first-ever build) and stop polling while the rebuild
  was still running. `graph_rebuild` now starts the job row synchronously and passes its
  id into `build_graph(ws, job_id)`, which reuses it instead of starting a second one.
- Brain Map: the topic map rendered blank on load. Topic nodes are pinned at PCA-scaled
  coordinates (`fx: t.x * 400, fy: t.y * 400`) that the default `react-force-graph-2d`
  camera (centered at the origin, zoom 1) never framed, so the canvas looked empty until
  the user manually scroll-zoomed out. `BrainMap.tsx` now holds a ref to the graph
  instance and calls `zoomToFit(400, 80)` from both `onEngineStop` (covers the
  drill-down's force-simulated doc nodes, which do cool) and a `setTimeout`-guarded
  effect keyed on the current node set + `topic` (covers the pinned topic-overview nodes,
  which never fire `onEngineStop` since they never simulate) — so the camera reframes on
  initial load, after a rebuild, on drill-in, and on returning to the overview. Also added
  always-on node labels (`nodeCanvasObjectMode`/`nodeCanvasObject` drawing `node.name`
  under each node in `--ink`) so the map is readable without hovering.
- Brain Map: the findings sidebar's permission-anomaly explanation printed raw group
  UUIDs (from the engine's `detail.consensus`/`detail.doc_groups`) instead of names.
  `BrainMap.tsx` now builds an id→name `Map` from the `groups` it already loads for the
  "View as" selector and passes it to `Findings.tsx`, which resolves both id arrays to
  comma-joined group names (falling back to "a group" for an unknown id, never a raw
  UUID) in a clearer sentence, e.g. "Shared with Everyone — broader than Finance, which
  the rest of this topic shares."
