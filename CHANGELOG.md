# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Retrieval & ingestion re-architecture spec —
  `docs/superpowers/specs/2026-07-25-retrieval-rearchitecture-design.md`. Backed by a 24-agent
  research run (12 web-research sweeps, 2 code audits, 3 competing architectures, 6 adversarial
  critiques). Core finding: the blocker is the **type of a citation** — `ParsedDoc(text: str)` plus
  `(page, char_start, char_end)` cannot express a cell range, an audio timespan, or a bbox, which is
  why "any format" and "cite the exact source" are currently mutually exclusive. Replaces the flat
  string with typed `blocks` carrying a modality-polymorphic `locator jsonb`, makes `chunks` a pure
  retrieval unit joined via `chunk_blocks`, and keeps everything in the one Postgres. Documents
  eleven verified accuracy defects (chief among them: `plainto_tsquery` ANDs every term and is used
  as a hard WHERE filter, so the lexical arm usually returns zero rows and "hybrid" silently
  degrades to dense-only; `to_tsvector('english', …)` over Cyrillic is a no-op stemmer), two
  data-destroying bugs (`citations` cascade-delete on re-ingest destroys the evidence for every past
  answer; `embed.py` assumes response ordering), and the absence of any CI or eval harness. Phases
  the work 1–5 (~17.5 engineer-weeks) with OCR, audio and the aggregation lane deferred, and records
  the architectures rejected on evidence (visual/ColPali late interaction, agent loops, a second
  datastore, GraphRAG, RAPTOR, semantic chunking, late chunking, HyDE).
- `web/scripts/seed-corpus.ts` (`npm run seed:corpus`) — bulk-loads a directory of
  documents plus a `manifest.json` (filename -> access-group names) through the real
  web API: mints a session for an existing seeded user directly in the auth DB
  (self-contained, like `scripts/seed.ts`), creates any missing access groups,
  uploads each file, sets its groups, and triggers an Atlas rebuild. Used to load a
  150-document synthetic demo corpus spanning all departments for testing
  permission-aware retrieval and the Atlas governance lenses end-to-end.
- `web/app/(app)/_components/Wordmark.tsx` — the dashboard sidebar now shows the icon mark
  next to "CompanyMind" (previously text-only), matching the mark already used in the
  marketing nav and the favicon: nested squares, violet inner square on the app's `--brain`
  token / hardcoded `#684BFF` in the standalone SVGs. Duplicated rather than shared-imported
  from `marketing/`, per the web/marketing deployable boundary.

### Changed
- `marketing/components/Wordmark.tsx` and `marketing/app/opengraph-image.tsx` switched from
  the previous "walls + 3-node lattice" icon to the same nested-squares mark as the favicon
  and dashboard, so the logo is now identical everywhere it appears — landing page nav, OG
  share image, both apps' favicons, dashboard sidebar — instead of two different marks under
  one name. Also removed the unused, wrong-branded (teal, pre-dates the violet accent switch)
  `web/public/logo-teal.svg`.
- **"Brain Map" renamed to "Atlas"** — the old label put the retired "CompBrain" brand name
  right back in the nav ("never CompBrain — old name", per this file's own rule). Route moved
  `web/app/(app)/dashboard/brain-map/` → `.../atlas/`, component `BrainMap` → `Atlas`
  (`Atlas.tsx`, was `BrainMap.tsx`), nav label and page `<h1>` updated, and every internal
  comment referencing "Brain Map" across `web/` and `engine/` updated to match. No database
  or API-route changes — the engine's `graph_*` tables and `/api/graph*` endpoints were
  already named neutrally and needed no changes.

### Fixed
- Atlas hover/click, root cause: force-graph resolves both through a shadow canvas — every
  node is painted in a unique flat color onto an invisible canvas, and each mouse move reads
  back the single pixel under the cursor (`ctx.getImageData`) to look up which node owns that
  color. Browsers that add noise to canvas pixel reads for anti-fingerprinting purposes —
  Brave's "Block fingerprinting" shield does this by default — corrupt that lookup, so the
  returned color occasionally lands close enough to a neighboring node's to misresolve, and hover
  fails for an unpredictable subset of nodes each reload. This is a browser privacy feature
  colliding with the library's interaction model, not an app bug, and it fully explains the
  earlier "some nodes hover, some don't" reports that survived the previous three-cause fix.
  Replaced force-graph's built-in hit-testing (`enablePointerInteraction={false}`, and removed
  the now-dead `nodePointerAreaPaint`) with our own geometric hit-testing: on every mouse move,
  compare cursor position against each node's actual on-screen position
  (`graph2ScreenCoords`) and pick the nearest one within its hit radius, matching the same
  hit-area/label-footprint geometry the old pixel-based version used. The dot lookup itself
  runs against a `d3-quadtree` spatial index (rebuilt every animation frame from live node
  positions, in graph space so pan/zoom alone never invalidates it) rather than scanning every
  node per mouse move, so it stays O(log n) as the corpus grows well past today's ~150
  documents; only the much smaller label-hit check (bounded by `degreeStats.hubThreshold`,
  capped at 12) remains a linear scan. Pan/drag is tracked
  separately so panning the canvas doesn't fight the cursor with hover changes, and a
  pan-release doesn't get mistaken for a click-to-open. Never touches canvas pixel data, so
  it's immune to farbling in Brave/Tor/any similarly-hardened browser, and also closes the
  "buried under a hub neighbour" risk the previous fix's cause #3 could only flag as
  precautionary — there's no shared paint-order buffer to bury a hit in anymore.
- Atlas department colors: only 4 of 13 departments rendered in color, the other 9 fell back
  to the same warm grey as "Everyone" — the palette was a hardcoded 5-name `DEPT_COLORS` map,
  but a department is just the first non-default access group name, so the set of names is
  open-ended and any new group went grey (91 of 152 documents, once the demo corpus was
  loaded). It also carried a dead `People` key that never matched the real `HR` group. The
  established departments stay pinned as anchors (Sales keeps the brand violet); everything
  else now derives a hue seeded from its own name, assigned across the departments actually
  present with forward probing so two departments can't land on the same hue — the seed alone
  collided (IT/Support, Security/Marketing). "Everyone" stays grey on purpose.
- Atlas hover: nodes underneath the department legend could not be hovered at all. The legend
  floated over the canvas (~12% of it) and, while its wrapper was `pointer-events-none`, every
  row is a clickable filter button that opts back in — and those buttons are full-width, so
  they were effectively the whole box, swallowing hover for any node parked behind them.
  Legend moved out of the canvas into its own toolbar row of chips; the canvas is now
  unobstructed (verified: points that hit-tested to `BUTTON` now hit-test to `CANVAS`).
- Atlas hover: only the node's dot was hoverable, never its filename label. At 150+ documents
  a dot is 2.6–11px across while its caption is the largest thing on screen, so aiming at the
  text — the natural target — hovered nothing. `nodePointerAreaPaint` now also covers the
  label's text box whenever the label is drawn.
- Atlas hover: nodes are now painted largest-degree-first so the smallest paint last. hover is
  resolved through a colour-indexed buffer where each node paints over the previous one, so a
  small dot in the dense core could have its hit area buried by hub neighbours that happened
  to come later in the array.
- Brain Map hover: every hover showed two overlapping tooltips — our own (filename ·
  connections · department) and force-graph's built-in one (which defaults to `node.name`,
  the raw filename) rendering right underneath it. Suppressed the built-in one
  (`nodeLabel={() => ''}`); ours was already the complete version of the same information.
- Brain Map layout: a 0-connection document could drift arbitrarily far from the rest of
  the graph — d3's charge (repulsion) force has no distance cutoff by default, so with no
  link force to hold it and only weak x/y gravity to pull it back, an orphan's equilibrium
  distance from the cluster was unbounded. Capped `charge.distanceMax(260)` so gravity always
  wins past that range, and gave zero-degree nodes stronger gravity (0.55 vs 0.22) so they
  settle near the cluster edge instead of drifting off on their own.
- Brain Map hover: still intermittently missed nodes after the redraw-loop fix below,
  especially right after the graph loads/rebuilds (while the force simulation is settling)
  or right after a pan/zoom. Root cause was in the vendored `force-graph` library, not our
  code: the invisible hit-test ("shadow") canvas that backs hover detection is repainted via
  a hardcoded 800ms throttle, decoupled from the visible canvas's own render loop — so while
  node screen positions are actively changing, the hit-test canvas can lag up to 0.8s behind
  what's on screen, and a cursor sitting exactly on a node samples a stale pixel. Patched the
  throttle down to 50ms via `patch-package` (`web/patches/force-graph+1.51.4.patch`); the
  Dockerfile's `deps` stage now also copies `patches/` before `npm ci` so the patch actually
  lands in the built image. Also gave the department legend `pointer-events-none` on its
  wrapper (buttons opt back in individually) — nodes the layout parks underneath it after
  panning were previously unhoverable for good, since the legend div ate the pointer events.
- Brain Map hover: most nodes wouldn't respond to hover ("only 1–2 nodes work"). The
  force-graph render loop paused once the graph settled, so hover only re-evaluated on the
  occasional redraw and a moving cursor skipped nodes. Keep the loop live
  (`autoPauseRedraw={false}`) and give the pointer hit-area a ~10px screen-space floor so
  every node — including small, low-degree ones — is reliably hoverable at any zoom. The
  hovered node now also shows a violet ring and enlarges slightly, so it's obvious which node
  you're on — especially for hubs, whose many neighbors otherwise stay lit.

### Added
- Brain Map **interactive focus + category filter**: the legend is now a filter — click a
  department to isolate its nodes (the rest dim, the chip gets a pill, a "Showing X" hint
  appears). Hovering or selecting a node lights it and its connected neighbors while dimming
  everything else, and shows a tooltip ("‹document› · N connections · ‹department›") glued to
  the node. A single click on a node opens it in Sources.
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
- Brain Map node sizing and hub-label threshold are now **relative to the current dataset**
  instead of fixed constants that needed re-tuning by hand every time the document count
  changed (went stale immediately after adding 72 demo documents — see below). A node's
  radius now maps its degree onto `[MIN_RADIUS, MAX_RADIUS]` normalized against the graph's
  own max degree (the single most-connected doc is always `MAX_RADIUS`, a disconnected one
  always `MIN_RADIUS`), then the whole range scales down as the document count grows past
  `REFERENCE_NODE_COUNT` (36 — the size it was last eyeballed at) so a bigger library doesn't
  render as bigger overlapping dots. The "hub" label threshold works the same way: instead of
  a fixed `degree >= 9`, it picks whatever degree keeps roughly the top 15% of nodes as hubs,
  clamped to an absolute 3–12 so a much larger library never buries the map in bold labels.
- Brain Map node sizing/glow, tuned closer to the 42Wiki reference after a closer look at
  it: nodes are ~25% smaller across the board (`radius(degree) = 2.4 + sqrt(degree)*1.25`,
  was `3.4 + sqrt(degree)*1.7`), and the soft focus-glow now only renders while something is
  actually hovered/searched/filtered — at rest the reference is flat, unglowed dots, and
  drawing a permanent glow on all ~36 nodes (the previous behavior) is what made nearby hubs
  blob into each other. Hub label size trimmed to match (13px/10px, was 15px/11px).
- Brain Map visual language, reshaped after the 42Wiki knowledge-map reference
  (wiki.42.uz/map), kept on our existing warm-paper light theme rather than its dark one.
  Unfocused nodes now recede to a single neutral tone (`MUTED`) instead of a faded version
  of their own department color, so whatever IS focused is the only color on screen — the
  clearest signal of "what's related" the map has had. High-degree hub documents render as
  bold, department-colored floating titles (a wordmark over the cluster they anchor) instead
  of plain node captions; regular labels get a paper-colored outline stroke instead of a
  rectangle halo, so they float over the edge mesh without boxing themselves in. The
  department legend lost its bordered card in favor of a soft radial wash, gained a glow on
  each swatch dot, and a `36 documents · 96 connections · 6 departments` / "Hover to focus ·
  click to open" stats-and-hint line now sits opposite it. Added floating +/−/fit zoom
  controls (top-right) as a discoverable alternative to wheel/pinch, and the search input is
  now a pill instead of a rectangle.
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
