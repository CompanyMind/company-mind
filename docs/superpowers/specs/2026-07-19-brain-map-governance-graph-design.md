# Brain Map — Governance-First Knowledge Graph (Design)

> Design spec. Brainstormed 2026-07-19. Status: approved, pending implementation plan.

## 1. Purpose & positioning

CompanyMind today is a "question in → cited answer out" black box. The **Brain Map** is a
visual, permission-aware map of everything a workspace knows — but its primary job is **not**
discovery or a sales demo. It is a **governance / trust surface for owners and the buyer's
security reviewer.**

This choice is deliberate. The Obsidian-style *global* graph is famously gorgeous in a demo and
abandoned in daily use. Governance gives an admin a **recurring reason to open it** (keep the
brain clean and provably-governed) and welds it to CompanyMind's actual moat: it turns the
permission model from a *claim* into something a reviewer can **see and audit**. The pretty
picture is a byproduct, not the point.

**The graph is the canvas; the product is the four lenses computed on top of it**, paired with a
ranked "things to fix" list where each finding deep-links into the existing document→groups
editor.

### Non-goals (explicitly deferred)
- 3D "presentation skin" for sales demos.
- Inline group-editing inside the graph (MVP deep-links to the existing editor instead).
- Automatic/incremental rebuild (MVP: manual button + rebuild-on-ingest, debounced).
- **GraphRAG** — using the derived graph to *improve* retrieval (multi-hop answers).
- The end-user "doorway-into-ask" explorer (a separate, member-facing feature).

## 2. Structure: two-level, level-of-detail

- **Level 1 — topic clusters.** 20–50 auto-labeled super-nodes (e.g. "Q3 Finance", "Vendor
  Contracts"). This is what opens. Edges are topic↔topic centroid similarity.
- **Level 2 — documents.** Drill into a topic to see its document nodes. Doc↔doc edges are
  computed **on drill-in, per cluster** (bounded — one cluster is hundreds of docs, not 100k),
  never stored globally. This is the key scale decision: the stored topic graph is tiny; the
  expensive edge set is computed lazily for one cluster at a time.

Nodes are **documents**, not chunks (too granular for governance) and not derived concepts (that
is GraphRAG, out of scope). Governance operates at the document level — you tag *documents* to
groups, you audit *documents*.

## 3. Data model (engine owns these knowledge tables)

New tables in the knowledge DB (engine-owned, per the domain-vs-delivery boundary):

```
graph_topics
  id              uuid pk
  workspace_id    uuid
  label           text          -- LLM-generated, e.g. "Vendor Contracts"
  keywords        text[]        -- top terms, for fallback label + tooltip
  centroid        vector(1024)  -- mean of member doc embeddings
  doc_count       int
  x, y            double        -- deterministic stored layout position
  computed_at     timestamptz

graph_topic_members
  topic_id        uuid fk -> graph_topics
  document_id     uuid fk -> documents
  (pk: topic_id, document_id)

graph_doc_meta
  document_id     uuid pk fk -> documents
  workspace_id    uuid
  topic_id        uuid fk -> graph_topics
  degree          int           -- neighbors above similarity threshold
  exposure_score  double        -- 0..1, breadth of group access (see §5)
  is_orphan       bool
  last_retrieved_at timestamptz  -- null = never retrieved (dead)
  computed_at     timestamptz

graph_findings
  id              uuid pk
  workspace_id    uuid
  kind            text          -- permission_anomaly | over_exposure | orphan | dead | stale
  document_id     uuid fk -> documents
  severity        double        -- 0..1, for ranking
  detail          jsonb         -- human-readable explanation + structured fields
  status          text          -- open | dismissed
  computed_at     timestamptz
```

`graph_build_job` mirrors the existing `ingestion_job` (id, workspace_id, status, error,
started_at, finished_at) so the UI can show build progress and "as of" freshness.

**Determinism note:** all vectors already exist in `chunks.embedding`. The build reads them; it
does not call the embedding model. With fake embedding providers (no GPU), clustering still
produces a *stable* shape, so tests assert structure without asserting semantic quality.

## 4. Build pipeline (CPU-only, deterministic, GPU-free)

Runs as a background `graph_build_job`:

1. **Doc embedding** = mean of the document's chunk vectors (unit-normalized). Documents with
   no embedded chunks (still ingesting/failed) are excluded.
2. **Cluster** doc vectors with **KMeans**, `k = clamp(round(sqrt(n/2)), 5, 50)`, fixed
   `random_state` → deterministic. (Chosen over Leiden/community detection to avoid heavy deps
   `igraph`/`leidenalg` and to guarantee determinism; see Open Question O1.)
3. **Label** each cluster: feed its top-TF-IDF terms + a few representative document titles to
   the LLM for a 2–4 word label. Fallback when `use_real_models()` is false: the top TF-IDF
   keyword, else "Topic N". Deterministic in fallback mode.
4. **Compute lenses** (§5) → `exposure_score`, `is_orphan`, anomaly + dead + stale findings.
5. **Layout:** deterministic 2D placement of topic centroids (e.g. seeded force layout or PCA of
   centroids → x,y) so an auditor returning later sees the *same* map.
6. **Persist** topics, members, doc-meta, findings; stamp `computed_at`.

**Triggers:** a manual **"Rebuild map"** button (always available) + automatic rebuild after
ingest completes, debounced so a bulk upload triggers one build, not N. Incremental rebuild is a
fast-follow, not MVP.

**New engine dependencies:** `numpy` + `scikit-learn` (KMeans, TF-IDF). Both are CPU-only and
pure-Python-friendly wheels; no GPU.

## 5. The four lenses

Each lens is a query over data that already exists, surfaced as (a) a visual encoding on the map
and (b) ranked rows in the findings list.

| Lens | Definition | Map encoding | Finding row → action |
|---|---|---|---|
| **Permission anomaly** | Doc's access-group set diverges from its cluster's consensus (majority group set). Broader than consensus = *over-shared*; disjoint/narrower = *siloed*. Severity = divergence magnitude. | Red halo on the doc | "'HR Policy' is **Everyone** but its 11 topic-neighbors are all **Finance**" → **Fix** (deep-link to doc→groups editor) |
| **Over-exposure** | `exposure_score` = normalized breadth of access. Docs readable by *Everyone* or `all_access` = max. | Heat color, cool→hot | Ranked most-exposed docs → **Fix** |
| **Orphan** | Max cosine similarity to any other doc < threshold (≈0.15), i.e. degree 0 in the kNN graph. | Floats at edge, greyed | "Connected to nothing — single-source-of-truth risk or junk" → open doc |
| **Dead / stale** | *Dead:* none of the doc's chunks appear in any `query_log.retrieved_chunk_ids` (`last_retrieved_at` is null). *Stale:* oldest by `created_at`, older than a threshold. | Dashed / faded outline | "Never retrieved" / "18 months old, never refreshed" → open doc |

**Permission anomaly is the flagship** — it is the one a security reviewer reacts to and the one
directly fixable from the map. `over_exposure` and `permission_anomaly` findings deep-link to the
group editor; `orphan`/`dead`/`stale` link to the document itself (to remove/refresh/merge).

`query_log.retrieved_chunk_ids` already exists — the dead lens needs **no** new logging.

## 6. Access model + "view as group"

- **Owner-only.** The map reveals cross-group structure, so its endpoints are gated to
  `role == "owner"` (all_access), enforced in **both** the web route and the engine. Non-owner
  members get 403; the Brain Map nav item is hidden for them.
- **View as group.** The owner picks a group (or "Owner / everything") from a dropdown. The
  engine re-filters nodes, edges, and findings through the *same* `resolve_access` predicate the
  live product uses — with a synthetic principal scoped to the chosen group. The owner then sees
  **exactly** what a member of Legal sees. This is a real permission audit, not a mock.

This reuse of `resolve_access` is intentional: the audit view and the production access path are
the same predicate, so what the auditor sees is provably what the product enforces.

## 7. Engine API surface

All under the internal secret guard (`x-engine-secret`), called by the web BFF:

- `POST /graph/rebuild` `{workspace_id}` → starts a `graph_build_job`, returns `{job}`.
- `GET  /graph?workspace_id&as_group=<id|owner>` → topic-level graph: nodes (topics with
  positions, doc_count, aggregated lens rollups), edges, `computed_at`, job status.
- `GET  /graph/topic/{topic_id}?workspace_id&as_group=` → doc-level: doc nodes (with per-doc lens
  flags) + doc↔doc edges for that one cluster, computed on demand.
- `GET  /graph/findings?workspace_id&as_group=&kind=` → ranked open findings.
- `POST /graph/findings/{id}/dismiss` `{workspace_id}` → mark a finding dismissed.

`as_group` filters everything through `resolve_access`; `owner` (or omitted) = full graph.

## 8. Web BFF + UI

- **Thin clients** in `web/lib/graph.ts` over the engine endpoints (Drizzle-free, like
  `documents.ts`/`groups.ts`). Auth + CSRF + the **owner-role check** stay in web.
- **Nav:** new left-rail item **Brain Map** (owner-only visibility).
- **Route:** `web/app/(app)/brain-map/page.tsx` + API routes proxying the engine clients.
- **Render:** `react-force-graph-2d` (canvas; bundles offline — **no CDN**, satisfying the CSP /
  sovereignty constraint). Top level = 20–50 fixed-position topic nodes; drill-in force-sims one
  cluster. Click topic → zoom; click doc → detail panel + Fix.
- **Layout:**
  ```
  ┌──────────────────────────────────────────────┬───────────────────────┐
  │ [Rebuild map · as of 14:22]  View as:[Owner ▾]│  FINDINGS (23 open)   │
  │                                               │ ● Permission anomaly  │
  │       ⬤ Finance      ⬤ Contracts              │   "HR Policy"→Everyone │
  │          ╲          ╱                          │   [Fix →]             │
  │           ⬤ Q3 Planning     ·orphan·           │ ● Over-exposed (×6)   │
  │       ⬤ Onboarding                            │ ● Orphan (×4)         │
  │                                               │ ● Dead / stale (×9)   │
  │ Lenses:[Anomaly][Exposure][Orphan][Dead/Stale]│                       │
  └──────────────────────────────────────────────┴───────────────────────┘
  ```
- **Brand:** violet accent (`--brain #684bff`), consistent with the rest of the app. Lens colors
  (red anomaly halo, exposure heat) are *semantic* and separate from the brand accent.

## 9. Testing strategy

- **Engine (pytest, fake providers, no GPU):** build pipeline produces deterministic
  clusters/labels on a seeded corpus; each lens fires on a constructed fixture (a planted
  over-shared doc, a planted orphan, a doc absent from all `retrieved_chunk_ids`, an old doc);
  `as_group` filtering hides docs the group can't see; owner sees all. `graph_build_job`
  lifecycle. Reuse the `DATABASE_URL`-gated pattern from `test_tg_store.py`.
- **Web (vitest):** `graph.ts` clients map engine payloads; owner-role gate returns 403 for
  members; CSRF enforced on rebuild/dismiss.
- **E2E (Playwright, Docker stack):** owner opens Brain Map → sees topic clusters → a planted
  permission anomaly appears in findings → Fix deep-links to the group editor → re-tag →
  rebuild → finding clears. "View as group" hides an owner-only doc.

## 10. Scope cut

**MVP:** build pipeline (mean-embed → KMeans → LLM label → 4 lenses → deterministic layout),
`graph_build_job`, the five engine endpoints, owner gate + view-as-group, `web/lib/graph.ts` +
Brain Map page with 2D render and topic→doc drill-in, findings sidebar with deep-link Fix,
"Rebuild map" button + freshness stamp.

**Deferred:** 3D presentation skin, inline group-editing on the map, auto/incremental rebuild,
GraphRAG retrieval use, member-facing doorway-into-ask explorer, WebGL 100k-node rendering.

## 11. Open questions

- **O1 — clustering algorithm.** MVP uses **KMeans** (deterministic, no heavy deps). Leiden/
  community detection gives more natural topic boundaries but adds `igraph`/`leidenalg`.
  Revisit if topic quality is poor on real corpora.
- **O2 — rebuild cost at scale.** Full rebuild on every ingest is costly at 100k docs. MVP
  debounces + offers manual rebuild; incremental rebuild (re-cluster only affected regions) is
  the fast-follow if this bites.
- **O3 — anomaly false positives.** Cluster-consensus anomaly detection may over-flag in mixed
  clusters. Severity ranking + `dismiss` mitigate; tune the divergence threshold on real data.
