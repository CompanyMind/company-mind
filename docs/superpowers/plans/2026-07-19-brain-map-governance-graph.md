# Brain Map — Governance Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an owner-only, permission-aware governance map of the workspace corpus — topic clusters → documents, with four "things to fix" lenses (permission anomaly, over-exposure, orphan, dead/stale) and a "view as group" audit.

**Architecture:** The engine owns a new `graph/` domain module that reads chunk embeddings + access data and materializes a graph (topics, members, per-doc metadata, findings) into new knowledge tables. A background build job produces it; read endpoints serve it, filtered per-principal through the existing `resolve_access`. Web is a thin BFF: `web/lib/graph.ts` clients + owner-gated API routes + a 2D `react-force-graph-2d` page.

**Tech Stack:** FastAPI/Python 3.12/`uv`, `numpy` + `scikit-learn` (KMeans, TF-IDF), psycopg3 + pgvector, Postgres. Web: Next.js 16 App Router, Drizzle (schema only), `react-force-graph-2d`.

**Spec:** `docs/superpowers/specs/2026-07-19-brain-map-governance-graph-design.md`

## Global Constraints

- **Domain boundary:** the engine owns ALL knowledge-table access (`engine/app/graph/*`). Web NEVER touches `graph_*` tables via Drizzle — only via engine endpoints behind `x-engine-secret`. Drizzle *defines* the tables (schema + migration) but does not read/write them.
- **GPU-free & deterministic:** the build reads `chunks.embedding` (never calls the embed model). All clustering/layout uses a fixed seed (`GRAPH_SEED = 42`). With fake providers (`use_real_models()` false), labels fall back deterministically; tests assert structure, not semantic quality.
- **psycopg3:** use `with conn.transaction()`, never `with conn:`. Connections come from `with get_conn() as conn:` (autocommit + `register_vector` already configured). Insert vectors via `%s::vector`.
- **EMBED_DIM = 1024**, pinned in `web/lib/db/schema.ts` and `engine/app/settings.py`.
- **Owner-only:** every Brain Map surface is gated to `role == 'owner'`. Web reads the role from the auth-owned `memberships` table (pattern in `web/app/(app)/s/[chunkId]/page.tsx`) and returns 403 for non-owners; the engine additionally treats the caller's principal via `resolve_access`.
- **CSRF:** mutations (`rebuild`, `dismiss`) verify the session-bound HMAC token in the web route.
- **Offline bundling:** `react-force-graph-2d` is an npm dependency bundled into the app — no CDN (CSP/sovereignty). It is client-only; import it with `next/dynamic` `{ ssr: false }`.
- **Changelog:** add an entry under `[Unreleased]` in `CHANGELOG.md` in the same commit as each user-visible change.

---

## File Structure

**Engine (new `graph/` domain module):**
- `engine/app/graph/__init__.py`
- `engine/app/graph/cluster.py` — pure: KMeans clustering + per-cluster TF-IDF keywords
- `engine/app/graph/layout.py` — pure: deterministic 2D positions from centroids
- `engine/app/graph/label.py` — cluster labeling (LLM + deterministic fallback)
- `engine/app/graph/lenses.py` — pure: the four governance lenses over plain structures
- `engine/app/graph/store.py` — DB reads (doc vectors/groups/retrieval/age) + writes (topics/members/doc_meta/findings) + `graph_build_jobs` lifecycle
- `engine/app/graph/service.py` — `build_graph`, `get_graph`, `get_topic`, `list_findings`, `dismiss_finding`
- `engine/app/graph/model.py` — small dataclasses shared across the module
- Modify: `engine/app/main.py` (endpoints), `engine/app/settings.py` (thresholds), `engine/pyproject.toml` (deps)
- Tests: `engine/tests/test_graph_cluster.py`, `test_graph_layout.py`, `test_graph_label.py`, `test_graph_lenses.py`, `test_graph_store.py`, `test_graph_service.py`

**Web (BFF + UI):**
- `web/lib/db/schema.ts` (+ generated migration) — the `graph_*` tables
- `web/lib/graph.ts` — thin engine clients + row types
- `web/app/api/graph/rebuild/route.ts`, `web/app/api/graph/route.ts`, `web/app/api/graph/topic/[id]/route.ts`, `web/app/api/graph/findings/route.ts`, `web/app/api/graph/findings/[id]/dismiss/route.ts`
- `web/app/(app)/dashboard/brain-map/page.tsx` (server) + `BrainMap.tsx` (client) + `Findings.tsx` (client)
- Modify: `web/app/(app)/_components/Rail.tsx` + `web/app/(app)/layout.tsx` (owner-only nav)
- Tests: `web/test/graph-client.test.ts`, `web/test/graph-owner-gate.test.ts`

---

## Task 1: Knowledge-DB schema for the graph tables

**Files:**
- Modify: `web/lib/db/schema.ts` (append after `documentGroups`)
- Create (generated): `web/lib/db/migrations/0007_*.sql`

**Interfaces:**
- Produces (for all engine tasks): tables `graph_build_jobs`, `graph_topics`, `graph_topic_members`, `graph_doc_meta`, `graph_findings` with the columns below.

- [ ] **Step 1: Add the tables to the Drizzle schema**

Append to `web/lib/db/schema.ts`:

```ts
export const graphBuildJobs = pgTable('graph_build_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'), // queued|running|done|failed
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const graphTopics = pgTable(
  'graph_topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    keywords: text('keywords').array(),
    centroid: vector('centroid', { dimensions: EMBED_DIM }),
    docCount: integer('doc_count').notNull().default(0),
    x: doublePrecision('x').notNull().default(0),
    y: doublePrecision('y').notNull().default(0),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('graph_topics_workspace_idx').on(t.workspaceId)],
)

export const graphTopicMembers = pgTable(
  'graph_topic_members',
  {
    topicId: uuid('topic_id')
      .notNull()
      .references(() => graphTopics.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.documentId] })],
)

export const graphDocMeta = pgTable('graph_doc_meta', {
  documentId: uuid('document_id')
    .primaryKey()
    .references(() => documents.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').references(() => graphTopics.id, { onDelete: 'set null' }),
  degree: integer('degree').notNull().default(0),
  exposureScore: doublePrecision('exposure_score').notNull().default(0),
  isOrphan: boolean('is_orphan').notNull().default(false),
  lastRetrievedAt: timestamp('last_retrieved_at', { withTimezone: true }),
  computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
})

export const graphFindings = pgTable(
  'graph_findings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // permission_anomaly|over_exposure|orphan|dead|stale
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    severity: doublePrecision('severity').notNull().default(0),
    detail: jsonb('detail'),
    status: text('status').notNull().default('open'), // open|dismissed
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('graph_findings_workspace_idx').on(t.workspaceId)],
)
```

Add `doublePrecision` and `jsonb` to the `drizzle-orm/pg-core` import at the top of the file.

- [ ] **Step 2: Generate the migration**

Run: `cd web && npm run db:generate` (drizzle-kit generate)
Expected: a new `web/lib/db/migrations/0007_*.sql` creating the five tables. Inspect it — it must `CREATE TABLE graph_topics ... centroid vector(1024)` and the two indexes.

- [ ] **Step 3: Apply against a scratch DB to confirm it's valid SQL**

Run: `cd web && DATABASE_URL=$SCRATCH_DB npm run db:migrate`
Expected: migrates cleanly, no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/db/schema.ts web/lib/db/migrations
git commit -m "Brain Map: knowledge-DB schema for graph_* tables"
```

---

## Task 2: Clustering + keywords (pure, no DB)

**Files:**
- Modify: `engine/pyproject.toml` (add deps)
- Create: `engine/app/graph/__init__.py` (empty), `engine/app/graph/cluster.py`
- Test: `engine/tests/test_graph_cluster.py`

**Interfaces:**
- Produces: `cluster_docs(vectors: np.ndarray, seed: int = 42) -> np.ndarray` → `labels` array of shape `(n,)`, int cluster index per row. `k = clamp(round(sqrt(n/2)), 1, 50)` (1 when n is tiny). `keywords_per_cluster(texts: list[str], labels: np.ndarray, top_n: int = 6) -> dict[int, list[str]]` — TF-IDF top terms per cluster.

- [ ] **Step 1: Add engine dependencies**

In `engine/pyproject.toml` add to `dependencies`:
```
  "numpy>=2.0",
  "scikit-learn>=1.5",
```
Run: `cd engine && uv sync`
Expected: resolves and installs numpy + scikit-learn.

- [ ] **Step 2: Write the failing test**

`engine/tests/test_graph_cluster.py`:
```python
import numpy as np
from app.graph.cluster import cluster_docs, keywords_per_cluster


def _blobs():
    rng = np.random.default_rng(0)
    a = rng.normal([5, 0, 0], 0.1, (10, 3))
    b = rng.normal([0, 5, 0], 0.1, (10, 3))
    return np.vstack([a, b]).astype(np.float32)


def test_cluster_is_deterministic_and_separates_blobs():
    v = _blobs()
    l1 = cluster_docs(v, seed=42)
    l2 = cluster_docs(v, seed=42)
    assert np.array_equal(l1, l2)                      # deterministic
    assert l1[:10].std() == 0 and l1[10:].std() == 0   # each blob is one cluster
    assert l1[0] != l1[10]                              # blobs are different clusters


def test_single_doc_is_one_cluster():
    assert list(cluster_docs(np.zeros((1, 3), np.float32))) == [0]


def test_keywords_pick_distinguishing_terms():
    texts = ["invoice payment finance", "invoice payment finance",
             "onboarding hr policy", "onboarding hr policy"]
    labels = np.array([0, 0, 1, 1])
    kw = keywords_per_cluster(texts, labels, top_n=2)
    assert "finance" in kw[0] and "onboarding" in kw[1]
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd engine && uv run pytest tests/test_graph_cluster.py -q`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `engine/app/graph/cluster.py`**

```python
import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer


def _k_for(n: int) -> int:
    if n <= 1:
        return 1
    return max(1, min(50, round((n / 2) ** 0.5)))


def cluster_docs(vectors: np.ndarray, seed: int = 42) -> np.ndarray:
    """KMeans cluster index per row. Deterministic for a fixed seed."""
    n = vectors.shape[0]
    k = _k_for(n)
    if k <= 1:
        return np.zeros(n, dtype=int)
    km = KMeans(n_clusters=k, random_state=seed, n_init=10)
    return km.fit_predict(vectors)


def keywords_per_cluster(
    texts: list[str], labels: np.ndarray, top_n: int = 6
) -> dict[int, list[str]]:
    """Top TF-IDF terms for each cluster, computed by treating each cluster's
    concatenated text as one document."""
    out: dict[int, list[str]] = {}
    order = sorted(set(int(x) for x in labels))
    docs = [" ".join(t for t, l in zip(texts, labels) if int(l) == c) for c in order]
    if not any(d.strip() for d in docs):
        return {c: [] for c in order}
    vec = TfidfVectorizer(stop_words="english", max_features=2000)
    m = vec.fit_transform(docs)
    terms = np.array(vec.get_feature_names_out())
    for i, c in enumerate(order):
        row = m[i].toarray().ravel()
        idx = row.argsort()[::-1][:top_n]
        out[c] = [terms[j] for j in idx if row[j] > 0]
    return out
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd engine && uv run pytest tests/test_graph_cluster.py -q`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/pyproject.toml engine/uv.lock engine/app/graph/__init__.py engine/app/graph/cluster.py engine/tests/test_graph_cluster.py
git commit -m "Brain Map: deterministic doc clustering + per-cluster keywords"
```

---

## Task 3: Deterministic 2D layout (pure)

**Files:**
- Create: `engine/app/graph/layout.py`
- Test: `engine/tests/test_graph_layout.py`

**Interfaces:**
- Produces: `layout_positions(centroids: np.ndarray, seed: int = 42) -> np.ndarray` → shape `(n, 2)`, normalized into roughly `[-1, 1]`. Deterministic. Handles n = 1 (returns `[[0, 0]]`).

- [ ] **Step 1: Write the failing test**

`engine/tests/test_graph_layout.py`:
```python
import numpy as np
from app.graph.layout import layout_positions


def test_positions_are_2d_deterministic_and_bounded():
    c = np.random.default_rng(1).normal(0, 1, (12, 8)).astype(np.float32)
    p1 = layout_positions(c, seed=42)
    p2 = layout_positions(c, seed=42)
    assert p1.shape == (12, 2)
    assert np.allclose(p1, p2)
    assert p1.min() >= -1.0001 and p1.max() <= 1.0001


def test_single_topic_at_origin():
    assert layout_positions(np.zeros((1, 4), np.float32)).tolist() == [[0.0, 0.0]]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && uv run pytest tests/test_graph_layout.py -q` → FAIL (module not found).

- [ ] **Step 3: Implement `engine/app/graph/layout.py`**

```python
import numpy as np
from sklearn.decomposition import PCA


def layout_positions(centroids: np.ndarray, seed: int = 42) -> np.ndarray:
    """Project topic centroids to 2D via PCA and normalize to ~[-1, 1].
    Deterministic (PCA sign is pinned so the map is stable across builds)."""
    n = centroids.shape[0]
    if n == 1:
        return np.zeros((1, 2))
    p = PCA(n_components=2, random_state=seed).fit_transform(centroids)
    # Pin sign: force the largest-|value| entry of each axis positive.
    for a in range(2):
        j = np.argmax(np.abs(p[:, a]))
        if p[j, a] < 0:
            p[:, a] = -p[:, a]
    span = np.max(np.abs(p)) or 1.0
    return p / span
```

- [ ] **Step 4: Run tests to verify they pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/app/graph/layout.py engine/tests/test_graph_layout.py
git commit -m "Brain Map: deterministic 2D topic layout (PCA, sign-pinned)"
```

---

## Task 4: Cluster labeling (LLM + deterministic fallback)

**Files:**
- Create: `engine/app/graph/label.py`
- Test: `engine/tests/test_graph_label.py`

**Interfaces:**
- Consumes: keywords + titles from Task 2; the LLM `call` seam mirrors `engine/app/ask/rerank.py` (`call: Callable[[str], str] | None`).
- Produces: `label_cluster(keywords: list[str], titles: list[str], call=None) -> str`. With no `call`, returns a deterministic label from keywords (title-cased first 1-2 keywords) or "Untitled topic".

- [ ] **Step 1: Write the failing test**

`engine/tests/test_graph_label.py`:
```python
from app.graph.label import label_cluster


def test_fallback_uses_keywords_deterministically():
    assert label_cluster(["finance", "invoice"], ["Q3.pdf"]) == "Finance · Invoice"
    assert label_cluster([], []) == "Untitled topic"


def test_llm_label_is_used_and_trimmed():
    calls = []

    def fake_call(prompt: str) -> str:
        calls.append(prompt)
        return '  "Vendor Contracts"\n'

    out = label_cluster(["contract", "vendor"], ["msa.pdf"], call=fake_call)
    assert out == "Vendor Contracts"
    assert "contract" in calls[0]  # keywords fed to the model
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implement `engine/app/graph/label.py`**

```python
from collections.abc import Callable


def _fallback(keywords: list[str]) -> str:
    kws = [k for k in keywords if k][:2]
    if not kws:
        return "Untitled topic"
    return " · ".join(w.capitalize() for w in kws)


def label_cluster(
    keywords: list[str], titles: list[str], call: Callable[[str], str] | None = None
) -> str:
    if call is None:
        return _fallback(keywords)
    prompt = (
        "Name this cluster of company documents in 2-4 words. Reply with only the name.\n"
        f"Keywords: {', '.join(keywords) or '(none)'}\n"
        f"Example titles: {', '.join(titles[:5]) or '(none)'}\n"
    )
    try:
        raw = call(prompt)
    except Exception:  # noqa: BLE001 — labeling never blocks a build
        return _fallback(keywords)
    label = raw.strip().strip('"').strip().splitlines()[0].strip() if raw else ""
    return label[:60] or _fallback(keywords)
```

- [ ] **Step 4: Run tests to verify they pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/app/graph/label.py engine/tests/test_graph_label.py
git commit -m "Brain Map: cluster labeling with deterministic fallback"
```

---

## Task 5: The four governance lenses (pure)

**Files:**
- Create: `engine/app/graph/model.py`, `engine/app/graph/lenses.py`
- Test: `engine/tests/test_graph_lenses.py`

**Interfaces:**
- Produces `engine/app/graph/model.py`:
```python
from dataclasses import dataclass, field
import numpy as np


@dataclass
class DocInfo:
    id: str
    groups: set[str]          # group ids that can see the doc
    vector: np.ndarray
    created_at_days: float     # age in days at build time
    retrieved: bool            # any chunk ever in query_log.retrieved_chunk_ids
    cluster: int = -1


@dataclass
class Finding:
    kind: str                  # permission_anomaly|over_exposure|orphan|dead|stale
    document_id: str
    severity: float
    detail: dict = field(default_factory=dict)
```
- Produces `engine/app/graph/lenses.py`:
  - `exposure_score(groups: set[str], everyone_id: str, group_count: int) -> float` (0..1; Everyone/all → 1.0)
  - `permission_findings(members: list[DocInfo], everyone_id: str) -> list[Finding]`
  - `orphan_docs(members: list[DocInfo], threshold: float = 0.15) -> list[Finding]` (max cosine to a clustermate < threshold; singletons are orphans)
  - `dead_stale_findings(docs: list[DocInfo], stale_days: float) -> list[Finding]`
  - `degrees(members: list[DocInfo], threshold: float = 0.15) -> dict[str, int]`

- [ ] **Step 1: Write model.py, then the failing test**

Create `engine/app/graph/model.py` (above). `engine/tests/test_graph_lenses.py`:
```python
import numpy as np
from app.graph.model import DocInfo
from app.graph import lenses


def _d(id, groups, vec, days=1.0, retrieved=True, cluster=0):
    return DocInfo(id, set(groups), np.array(vec, float), days, retrieved, cluster)


def test_exposure_everyone_is_max():
    assert lenses.exposure_score({"ev"}, "ev", 4) == 1.0
    assert lenses.exposure_score({"g1"}, "ev", 4) < 1.0
    assert lenses.exposure_score(set(), "ev", 4) == 0.0


def test_permission_anomaly_flags_the_odd_one_out():
    fin = "finance"
    members = [_d(f"d{i}", [fin], [1, 0]) for i in range(11)]
    members.append(_d("odd", ["ev"], [1, 0]))  # tagged Everyone in a Finance cluster
    out = lenses.permission_findings(members, everyone_id="ev")
    assert any(f.document_id == "odd" and f.kind == "permission_anomaly" for f in out)
    assert all(f.document_id != "d0" for f in out)  # consensus docs not flagged


def test_orphan_when_far_from_clustermates():
    members = [_d("a", ["g"], [1, 0]), _d("b", ["g"], [1, 0.01]),
               _d("far", ["g"], [0, 1])]
    out = {f.document_id for f in lenses.orphan_docs(members, threshold=0.5)}
    assert "far" in out and "a" not in out


def test_dead_and_stale():
    docs = [_d("dead", ["g"], [1, 0], retrieved=False),
            _d("old", ["g"], [1, 0], days=900),
            _d("fresh", ["g"], [1, 0], days=1)]
    kinds = {(f.document_id, f.kind) for f in lenses.dead_stale_findings(docs, stale_days=365)}
    assert ("dead", "dead") in kinds
    assert ("old", "stale") in kinds
    assert ("fresh", "stale") not in kinds and ("fresh", "dead") not in kinds
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implement `engine/app/graph/lenses.py`**

```python
import numpy as np
from .model import DocInfo, Finding


def exposure_score(groups: set[str], everyone_id: str, group_count: int) -> float:
    if not groups:
        return 0.0
    if everyone_id in groups or group_count <= 1:
        return 1.0
    return min(1.0, len(groups) / group_count)


def _cos(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _by_cluster(members: list[DocInfo]) -> dict[int, list[DocInfo]]:
    out: dict[int, list[DocInfo]] = {}
    for m in members:
        out.setdefault(m.cluster, []).append(m)
    return out


def permission_findings(members: list[DocInfo], everyone_id: str) -> list[Finding]:
    """Within each cluster, the consensus group set = groups present in > 50% of
    docs. A doc is anomalous when its group set diverges from consensus (Jaccard)."""
    findings: list[Finding] = []
    for cluster, docs in _by_cluster(members).items():
        if len(docs) < 4:
            continue
        counts: dict[str, int] = {}
        for d in docs:
            for g in d.groups:
                counts[g] = counts.get(g, 0) + 1
        consensus = {g for g, c in counts.items() if c > len(docs) / 2}
        if not consensus:
            continue
        for d in docs:
            union = d.groups | consensus
            if not union:
                continue
            jac = len(d.groups & consensus) / len(union)
            severity = 1.0 - jac
            if severity < 0.5:
                continue
            over = everyone_id in d.groups and everyone_id not in consensus
            findings.append(
                Finding(
                    "permission_anomaly",
                    d.id,
                    round(severity, 3),
                    {
                        "consensus": sorted(consensus),
                        "doc_groups": sorted(d.groups),
                        "direction": "over_shared" if over or d.groups > consensus else "siloed",
                    },
                )
            )
    return findings


def orphan_docs(members: list[DocInfo], threshold: float = 0.15) -> list[Finding]:
    findings: list[Finding] = []
    for cluster, docs in _by_cluster(members).items():
        for i, d in enumerate(docs):
            best = max(
                (_cos(d.vector, o.vector) for j, o in enumerate(docs) if j != i),
                default=0.0,
            )
            if best < threshold:
                findings.append(Finding("orphan", d.id, round(1.0 - best, 3),
                                        {"max_similarity": round(best, 3)}))
    return findings


def degrees(members: list[DocInfo], threshold: float = 0.15) -> dict[str, int]:
    deg: dict[str, int] = {d.id: 0 for d in members}
    for cluster, docs in _by_cluster(members).items():
        for i, d in enumerate(docs):
            deg[d.id] = sum(
                1 for j, o in enumerate(docs) if j != i and _cos(d.vector, o.vector) >= threshold
            )
    return deg


def dead_stale_findings(docs: list[DocInfo], stale_days: float) -> list[Finding]:
    findings: list[Finding] = []
    for d in docs:
        if not d.retrieved:
            findings.append(Finding("dead", d.id, 0.6, {"reason": "never retrieved"}))
        if d.created_at_days > stale_days:
            sev = min(1.0, d.created_at_days / (stale_days * 3))
            findings.append(Finding("stale", d.id, round(sev, 3),
                                    {"age_days": round(d.created_at_days)}))
    return findings
```

- [ ] **Step 4: Run tests to verify they pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add engine/app/graph/model.py engine/app/graph/lenses.py engine/tests/test_graph_lenses.py
git commit -m "Brain Map: governance lenses (anomaly, exposure, orphan, dead/stale)"
```

---

## Task 6: Store — DB reads/writes + build-job lifecycle

**Files:**
- Modify: `engine/app/settings.py` (thresholds)
- Create: `engine/app/graph/store.py`
- Test: `engine/tests/test_graph_store.py`

**Interfaces:**
- Consumes: `DocInfo`/`Finding` (Task 5), `get_conn` (`engine/app/db.py`), `resolve_access` (`engine/app/access.py`).
- Produces:
  - `load_docs(conn, ws) -> list[DocInfo]` — one row per document that has ≥1 embedded chunk: mean-of-chunk-vectors, its `document_groups`, `created_at` age in days, and `retrieved` (any chunk id in any `query_log.retrieved_chunk_ids`).
  - `group_count(conn, ws) -> int`, `everyone_id(conn, ws) -> str`
  - `write_build(conn, ws, topics, members, doc_meta, findings)` — replaces prior graph for the workspace in one transaction.
  - `start_job(conn, ws) -> str`, `finish_job(conn, ws, job_id, error=None)`, `latest_job(conn, ws) -> dict | None`
  - Read helpers: `read_topics(conn, ws, visible_doc_ids) `, `read_topic_docs(conn, ws, topic_id, visible_doc_ids)`, `read_findings(conn, ws, visible_doc_ids, kind=None)`, `dismiss(conn, ws, finding_id) -> bool`
- Settings added: `graph_orphan_threshold: float = 0.15`, `graph_stale_days: float = 365`, `graph_seed: int = 42`.

- [ ] **Step 1: Add settings**

In `engine/app/settings.py` (after retrieval settings):
```python
    # --- Brain Map (governance graph) ---
    graph_seed: int = 42
    graph_orphan_threshold: float = 0.15
    graph_stale_days: float = 365
```

- [ ] **Step 2: Write the failing integration test**

`engine/tests/test_graph_store.py` (DATABASE_URL-gated, mirrors `test_tg_store.py`):
```python
import os
import uuid
import numpy as np
import psycopg
import pytest

from app.graph import store

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _vec_lit(v):
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def _seed(conn, ws, ev, docs):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, "w", str(ws)))
    conn.execute("INSERT INTO groups (id,workspace_id,name,slug,is_default) "
                 "VALUES (%s,%s,'Everyone','everyone',true)", (ev, ws))
    for did, vec, gid in docs:
        conn.execute("INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status)"
                     " VALUES (%s,%s,%s,'text/plain',1,'k','indexed')", (did, ws, f"{did}.txt"))
        conn.execute("INSERT INTO chunks (document_id,workspace_id,ordinal,text,embedding) "
                     "VALUES (%s,%s,0,%s,%s::vector)", (did, ws, "hello world", _vec_lit(vec)))
        conn.execute("INSERT INTO document_groups (document_id,workspace_id,group_id) "
                     "VALUES (%s,%s,%s)", (did, ws, gid))


def test_load_docs_and_write_read_roundtrip():
    ws, ev = uuid.uuid4(), uuid.uuid4()
    d1, d2 = uuid.uuid4(), uuid.uuid4()
    dim = 1024
    v1 = [1.0] + [0.0] * (dim - 1)
    v2 = [0.0, 1.0] + [0.0] * (dim - 2)
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            from pgvector.psycopg import register_vector
            register_vector(conn)
            with conn.transaction():
                _seed(conn, ws, ev, [(d1, v1, ev), (d2, v2, ev)])
            docs = store.load_docs(conn, str(ws))
            assert len(docs) == 2
            assert docs[0].vector.shape == (dim,)
            assert store.everyone_id(conn, str(ws)) == str(ev)
            # write a trivial graph and read it back
            topics = [{"label": "T", "keywords": ["k"], "centroid": v1, "x": 0.0, "y": 0.0,
                       "doc_ids": [str(d1), str(d2)]}]
            meta = {str(d1): {"topic": 0, "degree": 1, "exposure": 1.0, "orphan": False,
                              "last_retrieved_at": None},
                    str(d2): {"topic": 0, "degree": 1, "exposure": 1.0, "orphan": False,
                              "last_retrieved_at": None}}
            from app.graph.model import Finding
            findings = [Finding("orphan", str(d2), 0.9, {"max_similarity": 0.0})]
            store.write_build(conn, str(ws), topics, meta, findings)
            vis = {str(d1), str(d2)}
            read_topics = store.read_topics(conn, str(ws), vis)
            assert len(read_topics) == 1 and read_topics[0]["doc_count"] == 2
            fnd = store.read_findings(conn, str(ws), vis)
            assert len(fnd) == 1 and fnd[0]["kind"] == "orphan"
            # permission filter: a doc not visible drops from topic count + findings
            read_one = store.read_topics(conn, str(ws), {str(d1)})
            assert read_one[0]["doc_count"] == 1
            assert store.read_findings(conn, str(ws), {str(d1)}) == []
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_job_lifecycle():
    ws = uuid.uuid4()
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,'w',%s)", (ws, str(ws)))
            jid = store.start_job(conn, str(ws))
            assert store.latest_job(conn, str(ws))["status"] == "running"
            store.finish_job(conn, str(ws), jid)
            assert store.latest_job(conn, str(ws))["status"] == "done"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
```

- [ ] **Step 3: Run test to verify it fails** → FAIL (module not found).

- [ ] **Step 4: Implement `engine/app/graph/store.py`**

```python
from datetime import datetime, timezone
import numpy as np
from .model import DocInfo, Finding


def _now():
    return datetime.now(timezone.utc)


def everyone_id(conn, ws: str) -> str:
    row = conn.execute(
        "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (ws,)
    ).fetchone()
    return str(row[0]) if row else ""


def group_count(conn, ws: str) -> int:
    return conn.execute("SELECT count(*) FROM groups WHERE workspace_id=%s", (ws,)).fetchone()[0]


def load_docs(conn, ws: str) -> list[DocInfo]:
    """One DocInfo per document with ≥1 embedded chunk. Mean chunk vector,
    its document_groups, age in days, and whether any chunk was ever retrieved."""
    # Mean vector per doc (pgvector rows arrive as numpy arrays via register_vector).
    rows = conn.execute(
        "SELECT c.document_id, c.embedding, d.created_at "
        "FROM chunks c JOIN documents d ON d.id=c.document_id "
        "WHERE c.workspace_id=%s AND c.embedding IS NOT NULL",
        (ws,),
    ).fetchall()
    acc: dict[str, list] = {}
    created: dict[str, datetime] = {}
    for did, emb, cat in rows:
        acc.setdefault(str(did), []).append(np.asarray(emb, dtype=float))
        created[str(did)] = cat
    # Groups per doc.
    grp: dict[str, set[str]] = {}
    for did, gid in conn.execute(
        "SELECT document_id, group_id FROM document_groups WHERE workspace_id=%s", (ws,)
    ).fetchall():
        grp.setdefault(str(did), set()).add(str(gid))
    # Retrieved chunk ids ever logged → the set of doc ids that own them.
    retrieved_docs: set[str] = set()
    for (chunk_ids,) in conn.execute(
        "SELECT retrieved_chunk_ids FROM query_log "
        "WHERE workspace_id=%s AND retrieved_chunk_ids IS NOT NULL",
        (ws,),
    ).fetchall():
        if chunk_ids:
            for did in conn.execute(
                "SELECT DISTINCT document_id FROM chunks "
                "WHERE workspace_id=%s AND id = ANY(%s::uuid[])",
                (ws, list(chunk_ids)),
            ).fetchall():
                retrieved_docs.add(str(did[0]))
    now = _now()
    out: list[DocInfo] = []
    for did, vecs in acc.items():
        mean = np.mean(np.vstack(vecs), axis=0)
        age = (now - created[did]).total_seconds() / 86400 if created.get(did) else 0.0
        out.append(DocInfo(did, grp.get(did, set()), mean, age, did in retrieved_docs))
    out.sort(key=lambda d: d.id)  # stable order for determinism
    return out


def start_job(conn, ws: str) -> str:
    row = conn.execute(
        "INSERT INTO graph_build_jobs (workspace_id, status, started_at) "
        "VALUES (%s,'running',%s) RETURNING id",
        (ws, _now()),
    ).fetchone()
    return str(row[0])


def finish_job(conn, ws: str, job_id: str, error: str | None = None) -> None:
    conn.execute(
        "UPDATE graph_build_jobs SET status=%s, error=%s, finished_at=%s "
        "WHERE id=%s AND workspace_id=%s",
        ("failed" if error else "done", error, _now(), job_id, ws),
    )


def latest_job(conn, ws: str) -> dict | None:
    r = conn.execute(
        "SELECT id,status,error,finished_at FROM graph_build_jobs "
        "WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 1",
        (ws,),
    ).fetchone()
    if not r:
        return None
    return {"id": str(r[0]), "status": r[1], "error": r[2],
            "computed_at": r[3].isoformat() if r[3] else None}


def _vec_lit(v) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in v) + "]"


def write_build(conn, ws, topics: list[dict], doc_meta: dict, findings: list[Finding]) -> None:
    """Replace the workspace's graph atomically. `topics` carry `doc_ids`."""
    with conn.transaction():
        conn.execute("DELETE FROM graph_findings WHERE workspace_id=%s", (ws,))
        conn.execute("DELETE FROM graph_doc_meta WHERE workspace_id=%s", (ws,))
        conn.execute("DELETE FROM graph_topic_members WHERE workspace_id=%s", (ws,))
        conn.execute("DELETE FROM graph_topics WHERE workspace_id=%s", (ws,))
        topic_ids: list[str] = []
        for t in topics:
            row = conn.execute(
                "INSERT INTO graph_topics (workspace_id,label,keywords,centroid,doc_count,x,y) "
                "VALUES (%s,%s,%s,%s::vector,%s,%s,%s) RETURNING id",
                (ws, t["label"], t["keywords"], _vec_lit(t["centroid"]),
                 len(t["doc_ids"]), t["x"], t["y"]),
            ).fetchone()
            tid = str(row[0])
            topic_ids.append(tid)
            for did in t["doc_ids"]:
                conn.execute(
                    "INSERT INTO graph_topic_members (topic_id,document_id,workspace_id) "
                    "VALUES (%s,%s,%s)", (tid, did, ws))
        for did, m in doc_meta.items():
            conn.execute(
                "INSERT INTO graph_doc_meta (document_id,workspace_id,topic_id,degree,"
                "exposure_score,is_orphan,last_retrieved_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (did, ws, topic_ids[m["topic"]] if m["topic"] is not None else None,
                 m["degree"], m["exposure"], m["orphan"], m["last_retrieved_at"]))
        for f in findings:
            import json
            conn.execute(
                "INSERT INTO graph_findings (workspace_id,kind,document_id,severity,detail,status) "
                "VALUES (%s,%s,%s,%s,%s,'open')",
                (ws, f.kind, f.document_id, f.severity, json.dumps(f.detail)))


def read_topics(conn, ws: str, visible: set[str]) -> list[dict]:
    rows = conn.execute(
        "SELECT t.id,t.label,t.keywords,t.x,t.y, "
        " array_agg(m.document_id) FILTER (WHERE m.document_id IS NOT NULL) "
        "FROM graph_topics t LEFT JOIN graph_topic_members m ON m.topic_id=t.id "
        "WHERE t.workspace_id=%s GROUP BY t.id ORDER BY t.label",
        (ws,),
    ).fetchall()
    out = []
    for r in rows:
        members = [str(x) for x in (r[5] or []) if str(x) in visible]
        if not members:
            continue
        out.append({"id": str(r[0]), "label": r[1], "keywords": r[2] or [],
                    "x": r[3], "y": r[4], "doc_count": len(members)})
    return out


def read_topic_docs(conn, ws: str, topic_id: str, visible: set[str]) -> list[dict]:
    rows = conn.execute(
        "SELECT d.id,d.filename,dm.exposure_score,dm.is_orphan,dm.last_retrieved_at "
        "FROM graph_topic_members m JOIN documents d ON d.id=m.document_id "
        "LEFT JOIN graph_doc_meta dm ON dm.document_id=d.id "
        "WHERE m.topic_id=%s AND m.workspace_id=%s",
        (topic_id, ws),
    ).fetchall()
    return [
        {"id": str(r[0]), "filename": r[1], "exposure_score": r[2] or 0.0,
         "is_orphan": bool(r[3]), "last_retrieved_at": r[4].isoformat() if r[4] else None}
        for r in rows if str(r[0]) in visible
    ]


def read_findings(conn, ws: str, visible: set[str], kind: str | None = None) -> list[dict]:
    q = ("SELECT f.id,f.kind,f.document_id,f.severity,f.detail,d.filename "
         "FROM graph_findings f JOIN documents d ON d.id=f.document_id "
         "WHERE f.workspace_id=%s AND f.status='open'")
    params: list = [ws]
    if kind:
        q += " AND f.kind=%s"
        params.append(kind)
    q += " ORDER BY f.severity DESC"
    rows = conn.execute(q, tuple(params)).fetchall()
    return [
        {"id": str(r[0]), "kind": r[1], "document_id": str(r[2]), "severity": r[3],
         "detail": r[4] or {}, "filename": r[5]}
        for r in rows if str(r[2]) in visible
    ]


def dismiss(conn, ws: str, finding_id: str) -> bool:
    cur = conn.execute(
        "UPDATE graph_findings SET status='dismissed' WHERE id=%s AND workspace_id=%s",
        (finding_id, ws))
    return cur.rowcount > 0
```

- [ ] **Step 5: Run tests to verify they pass** → PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/app/settings.py engine/app/graph/store.py engine/tests/test_graph_store.py
git commit -m "Brain Map: graph store (load/write/read + build-job lifecycle)"
```

---

## Task 7: Service — build orchestration + read/filter APIs

**Files:**
- Create: `engine/app/graph/service.py`
- Test: `engine/tests/test_graph_service.py`

**Interfaces:**
- Consumes: everything above + `resolve_access` + the LLM `call` seam (reuse the answerer's chat client; when `use_real_models()` is false, pass `call=None`).
- Produces:
  - `build_graph(ws: str) -> dict` — runs the whole pipeline inside `get_conn`, returns the finished job dict.
  - `_visible(conn, ws, user_id, role, as_group) -> set[str]` — the doc ids the principal may see. `as_group` in (`None`/`"owner"` → all docs; a group id → that group's docs only, via `resolve_access`-style filter).
  - `get_graph(ws, user_id, role, as_group) -> dict` — `{topics, edges, job}`.
  - `get_topic(ws, topic_id, user_id, role, as_group) -> dict` — `{nodes, edges}` with doc↔doc edges computed on demand.
  - `list_findings(ws, user_id, role, as_group, kind) -> list[dict]`
  - `dismiss_finding(ws, finding_id) -> bool`

- [ ] **Step 1: Write the failing integration test**

`engine/tests/test_graph_service.py` (DATABASE_URL-gated). Seed a workspace with two well-separated blobs of docs, one planted over-shared doc, run `build_graph`, then assert: topics exist; a `permission_anomaly` finding names the planted doc; `get_graph` as the owner shows all topics; `_visible` for a restricted group hides docs. (Full seed helper mirrors Task 6's `_seed`, with `dim=1024` unit vectors placed in two directions and a third "Finance"-tagged group.)

```python
import os, uuid, numpy as np, psycopg, pytest
from pgvector.psycopg import register_vector
from app.graph import service, store

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")
# ... _seed(...) inserts workspace, Everyone + Finance groups, N docs across two
#     embedding directions, one doc mis-tagged Everyone inside the Finance blob ...

def test_build_produces_topics_and_flags_anomaly(seeded):  # fixture returns (ws, odd_doc_id)
    ws, odd = seeded
    job = service.build_graph(ws)
    assert job["status"] == "done"
    g = service.get_graph(ws, user_id="", role="owner", as_group=None)
    assert len(g["topics"]) >= 1
    findings = service.list_findings(ws, user_id="", role="owner", as_group=None, kind=None)
    assert any(f["document_id"] == odd and f["kind"] == "permission_anomaly" for f in findings)
```

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implement `engine/app/graph/service.py`**

```python
import numpy as np
from ..db import get_conn
from ..access import resolve_access
from ..settings import settings
from ..ask.answer import get_chat_call  # returns a Callable|None based on use_real_models()
from .model import DocInfo
from . import cluster, layout, label, lenses, store


def _visible(conn, ws, user_id: str, role: str, as_group) -> set[str]:
    """Doc ids the principal may see. Owner/None → all; a group id → docs tagged
    with the access set that a member of that group would resolve to."""
    all_ids = {d[0] and str(d[0]) for d in conn.execute(
        "SELECT id FROM documents WHERE workspace_id=%s", (ws,)).fetchall()}
    all_ids = {str(x) for x in all_ids if x}
    if as_group in (None, "", "owner"):
        return all_ids
    gids = [as_group]
    rows = conn.execute(
        "SELECT DISTINCT document_id FROM document_groups "
        "WHERE workspace_id=%s AND group_id = ANY(%s::uuid[])", (ws, gids)).fetchall()
    return {str(r[0]) for r in rows}


def build_graph(ws: str) -> dict:
    with get_conn() as conn:
        job_id = store.start_job(conn, ws)
        try:
            docs = store.load_docs(conn, ws)
            ev = store.everyone_id(conn, ws)
            gcount = store.group_count(conn, ws)
            if not docs:
                store.write_build(conn, ws, [], {}, [])
                store.finish_job(conn, ws, job_id)
                return store.latest_job(conn, ws)
            vectors = np.vstack([d.vector for d in docs])
            labels = cluster.cluster_docs(vectors, seed=settings.graph_seed)
            for d, l in zip(docs, labels):
                d.cluster = int(l)
            # keywords + labels per cluster
            texts = _doc_texts(conn, ws, [d.id for d in docs])
            kw = cluster.keywords_per_cluster(texts, labels)
            call = get_chat_call()
            # centroids in cluster order
            order = sorted(set(int(x) for x in labels))
            centroids = np.vstack([vectors[labels == c].mean(axis=0) for c in order])
            pos = layout.layout_positions(centroids, seed=settings.graph_seed)
            topics = []
            cluster_to_idx = {c: i for i, c in enumerate(order)}
            for i, c in enumerate(order):
                member_ids = [d.id for d in docs if d.cluster == c]
                titles = [t for d, t in zip(docs, texts) if d.cluster == c][:5]
                topics.append({
                    "label": label.label_cluster(kw.get(c, []), titles, call=call),
                    "keywords": kw.get(c, []), "centroid": centroids[i],
                    "x": float(pos[i][0]), "y": float(pos[i][1]), "doc_ids": member_ids})
            # lenses
            deg = lenses.degrees(docs, settings.graph_orphan_threshold)
            findings = (
                lenses.permission_findings(docs, ev)
                + lenses.orphan_docs(docs, settings.graph_orphan_threshold)
                + lenses.dead_stale_findings(docs, settings.graph_stale_days))
            orphan_ids = {f.document_id for f in findings if f.kind == "orphan"}
            doc_meta = {
                d.id: {"topic": cluster_to_idx[d.cluster], "degree": deg.get(d.id, 0),
                       "exposure": lenses.exposure_score(d.groups, ev, gcount),
                       "orphan": d.id in orphan_ids, "last_retrieved_at": None}
                for d in docs}
            store.write_build(conn, ws, topics, doc_meta, findings)
            store.finish_job(conn, ws, job_id)
        except Exception as e:  # noqa: BLE001
            store.finish_job(conn, ws, job_id, error=str(e)[:500])
            raise
        return store.latest_job(conn, ws)


def _doc_texts(conn, ws, doc_ids: list[str]) -> list[str]:
    """First chunk text per doc, in the same order as doc_ids (for keywords/titles)."""
    rows = conn.execute(
        "SELECT DISTINCT ON (document_id) document_id, text FROM chunks "
        "WHERE workspace_id=%s AND document_id = ANY(%s::uuid[]) ORDER BY document_id, ordinal",
        (ws, doc_ids)).fetchall()
    by_id = {str(r[0]): r[1] for r in rows}
    return [by_id.get(did, "") for did in doc_ids]


def get_graph(ws, user_id, role, as_group) -> dict:
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        topics = store.read_topics(conn, ws, vis)
        job = store.latest_job(conn, ws)
    # top-level edges: connect topics whose centroids are near (computed client-free
    # here is optional; MVP returns none and lets the client force-lay the topics).
    return {"topics": topics, "edges": [], "job": job}


def get_topic(ws, topic_id, user_id, role, as_group) -> dict:
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        nodes = store.read_topic_docs(conn, ws, topic_id, vis)
    return {"nodes": nodes, "edges": []}  # doc↔doc edges: fast-follow (kNN on demand)


def list_findings(ws, user_id, role, as_group, kind) -> list[dict]:
    with get_conn() as conn:
        vis = _visible(conn, ws, user_id, role, as_group)
        return store.read_findings(conn, ws, vis, kind)


def dismiss_finding(ws, finding_id) -> bool:
    with get_conn() as conn:
        return store.dismiss(conn, ws, finding_id)
```

- [ ] **Step 4: Add the `get_chat_call` seam**

In `engine/app/ask/answer.py`, extract the existing LLM HTTP call into a reusable `get_chat_call() -> Callable[[str], str] | None` that returns `None` when `use_real_models()` is false (so `label_cluster` falls back). Keep `_llm_answer` using it. (If a single-prompt chat helper already exists, wrap it; do not duplicate the Bearer/header logic.)

- [ ] **Step 5: Run tests to verify they pass** → PASS.

- [ ] **Step 6: Commit**

```bash
git add engine/app/graph/service.py engine/app/ask/answer.py engine/tests/test_graph_service.py
git commit -m "Brain Map: build orchestration + permission-filtered read APIs"
```

---

## Task 8: Engine HTTP endpoints

**Files:**
- Modify: `engine/app/main.py`
- Test: `engine/tests/test_graph_service.py` (add a FastAPI `TestClient` case) — optional light coverage.

**Interfaces:**
- Consumes: `engine/app/graph/service.py`.
- Produces endpoints (all `Depends(require_secret)`):
  - `POST /graph/rebuild` `{workspace_id}` → runs `build_graph` in a `BackgroundTasks` task; returns `{job: latest_job}` (status `running`).
  - `GET /graph?workspace_id&user_id&role&as_group` → `service.get_graph`.
  - `GET /graph/topic/{topic_id}?workspace_id&user_id&role&as_group` → `service.get_topic`.
  - `GET /graph/findings?workspace_id&user_id&role&as_group&kind` → `{findings: [...]}`.
  - `POST /graph/findings/{finding_id}/dismiss` `{workspace_id}` → `{ok}` / 404.

- [ ] **Step 1: Add the endpoints** (after the telegram block in `engine/app/main.py`)

```python
from .graph import service as graph_service


class GraphRebuildBody(BaseModel):
    workspace_id: str


@app.post("/graph/rebuild", dependencies=[Depends(require_secret)])
def graph_rebuild(body: GraphRebuildBody, background: BackgroundTasks):
    with get_conn() as conn:
        job_id = graph_service.store.start_job(conn, body.workspace_id)
    # The job row is already 'running'; do the heavy build off-request. build_graph
    # opens its own job — so instead call the internal builder that reuses job_id.
    background.add_task(graph_service.build_graph, body.workspace_id)
    with get_conn() as conn:
        return {"job": graph_service.store.latest_job(conn, body.workspace_id)}


@app.get("/graph", dependencies=[Depends(require_secret)])
def graph_get(workspace_id: str, user_id: str = "", role: str = "member", as_group: str = ""):
    return graph_service.get_graph(workspace_id, user_id, role, as_group or None)


@app.get("/graph/topic/{topic_id}", dependencies=[Depends(require_secret)])
def graph_topic(topic_id: str, workspace_id: str, user_id: str = "", role: str = "member",
                as_group: str = ""):
    return graph_service.get_topic(workspace_id, topic_id, user_id, role, as_group or None)


@app.get("/graph/findings", dependencies=[Depends(require_secret)])
def graph_findings(workspace_id: str, user_id: str = "", role: str = "member",
                   as_group: str = "", kind: str = ""):
    return {"findings": graph_service.list_findings(
        workspace_id, user_id, role, as_group or None, kind or None)}


class GraphWsBody(BaseModel):
    workspace_id: str


@app.post("/graph/findings/{finding_id}/dismiss", dependencies=[Depends(require_secret)])
def graph_dismiss(finding_id: str, body: GraphWsBody):
    if not graph_service.dismiss_finding(body.workspace_id, finding_id):
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}
```

Note: simplify `graph_rebuild` to just `background.add_task(graph_service.build_graph, ...)` and return `build_graph`'s eventual job by reading `latest_job` — `build_graph` creates and finishes its own job row, so the initial response may show the *previous* job's status or none; the web UI polls. Remove the redundant `start_job` call in the endpoint.

- [ ] **Step 2: Verify the app imports + boots**

Run: `cd engine && uv run python -c "from app.main import app; print(len(app.routes))"`
Expected: prints a route count (no import error).

- [ ] **Step 3: Run the full engine suite**

Run: `cd engine && uv run pytest -q`
Expected: all pass (new graph tests + existing).

- [ ] **Step 4: Commit**

```bash
git add engine/app/main.py
git commit -m "Brain Map: engine endpoints (rebuild/graph/topic/findings/dismiss)"
```

---

## Task 9: Web BFF client

**Files:**
- Create: `web/lib/graph.ts`
- Test: `web/test/graph-client.test.ts`

**Interfaces:**
- Produces (types + funcs consumed by the page/routes):
```ts
export type TopicNode = { id: string; label: string; keywords: string[]; x: number; y: number; docCount: number }
export type Finding = { id: string; kind: string; documentId: string; severity: number; detail: Record<string, unknown>; filename: string }
export type DocNode = { id: string; filename: string; exposureScore: number; isOrphan: boolean; lastRetrievedAt: string | null }
export function getGraph(ws, userId, role, asGroup): Promise<{ topics: TopicNode[]; job: JobInfo | null }>
export function getTopic(ws, topicId, userId, role, asGroup): Promise<{ nodes: DocNode[] }>
export function listFindings(ws, userId, role, asGroup, kind?): Promise<Finding[]>
export function rebuildGraph(ws): Promise<JobInfo | null>
export function dismissFinding(ws, id): Promise<boolean>
```
(mirror the `engineFetch`/`engineJson` helper pattern from `web/lib/groups.ts`; snake_case → camelCase mapping.)

- [ ] **Step 1: Write the failing test**

`web/test/graph-client.test.ts` — mock `fetch`, assert `getGraph` maps `doc_count → docCount` and forwards `as_group`; `listFindings` maps `document_id → documentId`. (Follow the existing vitest client tests if present; otherwise a minimal `vi.stubGlobal('fetch', ...)`.)

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implement `web/lib/graph.ts`** (engineFetch/engineJson as in `groups.ts`; map fields; build query strings with `as_group` only when set).

- [ ] **Step 4: Run test to verify it passes** → `cd web && npm test -- graph-client` → PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/graph.ts web/test/graph-client.test.ts
git commit -m "Brain Map: web BFF client for the graph endpoints"
```

---

## Task 10: Owner-gated API routes

**Files:**
- Create: `web/app/api/graph/route.ts`, `web/app/api/graph/rebuild/route.ts`, `web/app/api/graph/topic/[id]/route.ts`, `web/app/api/graph/findings/route.ts`, `web/app/api/graph/findings/[id]/dismiss/route.ts`
- Create: `web/lib/auth/require-owner.ts` (helper)
- Test: `web/test/graph-owner-gate.test.ts`

**Interfaces:**
- Produces `require-owner.ts`:
```ts
// Returns { user, workspace, role } or null; role read from the memberships table.
export async function getOwner(): Promise<{ userId: string; workspaceId: string } | null>
```
Reads role from `memberships` (like `s/[chunkId]/page.tsx`), returns null unless `role === 'owner'`.

- [ ] **Step 1: Write the failing test** — a non-owner membership → the route returns 403; owner → 200. Mock `getCurrentUser` + the `memberships` query + the graph client.

- [ ] **Step 2: Run test to verify it fails** → FAIL.

- [ ] **Step 3: Implement the helper + routes.** Each route:
  - `GET /api/graph`: `const o = await getOwner(); if (!o) return 401/403; const asGroup = req.nextUrl.searchParams.get('as_group'); return getGraph(o.workspaceId, o.userId, 'owner', asGroup)`. The owner always queries the engine as `role='owner'`; `as_group` drives the "view as" filter.
  - `POST /api/graph/rebuild` and `.../dismiss`: additionally `verifyCsrf(req)` (pattern from `web/app/api/telegram-links/[id]/route.ts`).

- [ ] **Step 4: Run test to verify it passes** → PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/graph web/lib/auth/require-owner.ts web/test/graph-owner-gate.test.ts
git commit -m "Brain Map: owner-gated API routes (+ CSRF on mutations)"
```

---

## Task 11: Rail nav (owner-only)

**Files:**
- Modify: `web/app/(app)/_components/Rail.tsx`, `web/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `isOwner: boolean` prop added to `Rail`.

- [ ] **Step 1: Add `isOwner` to Rail and conditionally include the nav item**

In `Rail.tsx`, change the signature to accept `isOwner: boolean` and build `NAV` so the `{ href: '/dashboard/brain-map', label: 'Brain Map' }` entry is appended only when `isOwner`.

- [ ] **Step 2: Pass `isOwner` from the layout**

In `web/app/(app)/layout.tsx`, read the membership role (same `db.query.memberships.findFirst` pattern as `s/[chunkId]/page.tsx`) and pass `isOwner={mem?.role === 'owner'}` to `<Rail />`.

- [ ] **Step 3: Verify build/typecheck**

Run: `cd web && npm run build`
Expected: compiles (no DB needed — lazy client).

- [ ] **Step 4: Commit**

```bash
git add "web/app/(app)/_components/Rail.tsx" "web/app/(app)/layout.tsx"
git commit -m "Brain Map: owner-only nav entry"
```

---

## Task 12: Brain Map page + 2D graph + findings

**Files:**
- Add dep: `react-force-graph-2d` (+ its peer `react`), in `web/package.json`
- Create: `web/app/(app)/dashboard/brain-map/page.tsx` (server), `BrainMap.tsx` (client), `Findings.tsx` (client)

**Interfaces:**
- Consumes: `getGraph`, `getTopic`, `listFindings`, `rebuildGraph`, `dismissFinding` via the API routes (client components `fetch('/api/graph...')`), `issueCsrf` for mutations.

- [ ] **Step 1: Install the renderer**

Run (with the Docker build image's npm to keep the lockfile in sync, per the gotcha we already hit):
`docker run --rm -v "$PWD/web":/app -w /app node:22-slim npm install react-force-graph-2d`
Expected: `web/package.json` + `web/package-lock.json` updated.

- [ ] **Step 2: Server page** `web/app/(app)/dashboard/brain-map/page.tsx`

```tsx
import { redirect } from 'next/navigation'
import { getOwner } from '@/lib/auth/require-owner'
import { issueCsrf } from '@/lib/csrf'
import { listGroups } from '@/lib/groups'
import { BrainMap } from './BrainMap'

export const runtime = 'nodejs'

export default async function BrainMapPage() {
  const owner = await getOwner()
  if (!owner) redirect('/dashboard')
  const csrf = await issueCsrf()
  const groups = await listGroups(owner.workspaceId)
  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-line px-6 py-4">
        <h1 className="font-display text-2xl text-ink">Brain Map</h1>
        <p className="mt-1 text-body-sm text-ink-soft">
          What your company knows, who can see it, and what needs fixing.
        </p>
      </header>
      <BrainMap csrf={csrf} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
    </div>
  )
}
```

- [ ] **Step 3: Client `BrainMap.tsx`** — dynamic-import the renderer (`ssr:false`), load `/api/graph`, render topic nodes at their `x,y` (scaled to canvas), color by selected lens, drill into a topic via `/api/graph/topic/[id]`, and host the `Findings` sidebar + toolbar (Rebuild button, "View as" `<select>` of groups, lens toggles).

```tsx
'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Findings } from './Findings'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type Topic = { id: string; label: string; x: number; y: number; docCount: number }

export function BrainMap({ csrf, groups }: { csrf: string; groups: { id: string; name: string }[] }) {
  const [asGroup, setAsGroup] = useState('')            // '' = owner/everything
  const [topics, setTopics] = useState<Topic[]>([])
  const [job, setJob] = useState<{ status: string; computed_at: string | null } | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  const load = useCallback(async () => {
    const qs = asGroup ? `?as_group=${asGroup}` : ''
    const r = await fetch(`/api/graph${qs}`, { cache: 'no-store' })
    const d = await r.json()
    setTopics(d.topics ?? [])
    setJob(d.job ?? null)
  }, [asGroup])

  useEffect(() => { void load() }, [load])

  const rebuild = async () => {
    setRebuilding(true)
    await fetch('/api/graph/rebuild', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({}),
    })
    // poll until done
    const poll = setInterval(async () => {
      await load()
      if (job?.status !== 'running') { clearInterval(poll); setRebuilding(false) }
    }, 1500)
  }

  const graphData = useMemo(
    () => ({ nodes: topics.map((t) => ({ id: t.id, name: t.label, val: t.docCount, fx: t.x * 400, fy: t.y * 400 })), links: [] }),
    [topics],
  )

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2 text-body-sm">
          <button onClick={rebuild} disabled={rebuilding}
            className="rounded border border-line px-2 py-1 hover:bg-paper-sunk">
            {rebuilding ? 'Rebuilding…' : 'Rebuild map'}
          </button>
          <span className="text-ink-soft">
            {job?.computed_at ? `as of ${new Date(job.computed_at).toLocaleTimeString()}` : 'never built'}
          </span>
          <label className="ml-auto flex items-center gap-2">
            View as:
            <select value={asGroup} onChange={(e) => setAsGroup(e.target.value)}
              className="rounded border border-line px-2 py-1">
              <option value="">Owner · everything</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        </div>
        <ForceGraph2D graphData={graphData} nodeLabel="name" nodeRelSize={6}
          nodeColor={() => '#684bff'} backgroundColor="transparent" />
      </div>
      <Findings csrf={csrf} asGroup={asGroup} onChanged={load} />
    </div>
  )
}
```

- [ ] **Step 4: Client `Findings.tsx`** — fetch `/api/graph/findings`, group by `kind`, render ranked rows; each row shows the explanation from `detail` and a **Fix** link. For `permission_anomaly`/`over_exposure` the Fix links to `/dashboard/sources?doc=<documentId>` (the existing group editor); for `orphan`/`dead`/`stale` it links to `/s/<...>` or the sources row. A **Dismiss** button POSTs `/api/graph/findings/[id]/dismiss` with the CSRF header then calls `onChanged()`.

- [ ] **Step 5: Verify build/typecheck**

Run: `cd web && npm run build`
Expected: compiles. (If the renderer trips SSR, confirm the `dynamic(..., { ssr:false })` import.)

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json "web/app/(app)/dashboard/brain-map"
git commit -m "Brain Map: owner page — 2D topic map, view-as-group, findings sidebar"
```

---

## Task 13: Deep-link Fix target in Sources

**Files:**
- Modify: `web/app/(app)/dashboard/sources/page.tsx` + `web/app/(app)/dashboard/Sources.tsx` (or wherever the doc→groups editor lives)

**Interfaces:**
- Consumes: a `?doc=<id>` query param → the Sources page opens/scrolls to that document's group editor.

- [ ] **Step 1:** Read the current Sources component to find the group-editor entry point.
- [ ] **Step 2:** Support `?doc=<id>`: on mount, if present, select/expand that document's group controls (and optionally scroll into view). No new editing code — reuse `setDocumentGroups`.
- [ ] **Step 3:** Verify build. Commit:

```bash
git commit -am "Brain Map: Sources accepts ?doc= to open a document's group editor"
```

---

## Task 14: Changelog, docs, and end-to-end verification

**Files:**
- Modify: `CHANGELOG.md`, `CLAUDE.md` (migration-status note)

- [ ] **Step 1: Changelog** — under `[Unreleased] / Added`: "Brain Map — owner-only permission-aware governance graph (topic clusters → documents) with permission-anomaly / over-exposure / orphan / dead-stale lenses, view-as-group audit, and deep-link fixes."

- [ ] **Step 2: CLAUDE.md** — add a one-line pointer under an appropriate section that the Brain Map is the governance surface over the knowledge tables, engine-owned (`engine/app/graph/*`), Drizzle-defined tables `graph_*`.

- [ ] **Step 3: Full engine + web suites**

Run: `cd engine && uv run pytest -q` and `cd web && npm test`
Expected: green.

- [ ] **Step 4: E2E on the Docker stack (Playwright)**

Bring up the stack, seed an owner account with a few documents in two clear topics + one deliberately over-shared doc, then:
1. Log in as owner → **Brain Map** appears in the rail (and is absent for a member account).
2. Click **Rebuild map** → topic clusters render; "as of" timestamp updates.
3. The over-shared doc appears under **Permission anomaly**; click **Fix** → lands on Sources with that doc's group editor open.
4. Re-tag it correctly → Rebuild → the finding clears.
5. **View as** a restricted group → owner-only docs disappear from the map and findings.

Record the run; clean up test artifacts.

- [ ] **Step 5: Commit + finish**

```bash
git add CHANGELOG.md CLAUDE.md
git commit -m "Brain Map: changelog + docs; E2E verified"
```

Then invoke **superpowers:finishing-a-development-branch** to verify tests, present merge/PR options, and complete.

---

## Self-Review notes (author)

- **Spec coverage:** §2 two-level → Tasks 2/7/12; §3 tables → Task 1; §4 build pipeline → Tasks 2-7; §5 four lenses → Task 5 (+wiring Task 7); §6 owner + view-as-group → Tasks 7/10/11; §7 endpoints → Task 8; §8 BFF+UI → Tasks 9-13; §9 testing → per-task + Task 14.
- **Deferred (not planned, per spec §10):** 3D skin, inline editing, auto/incremental rebuild, GraphRAG, member explorer, WebGL scale, and doc↔doc edges on drill-in (endpoints return `edges: []` for now — the client force-lays intra-cluster docs; real kNN edges are a fast-follow noted in Task 7/8).
- **Type consistency:** engine dicts use snake_case (`doc_count`, `document_id`); `web/lib/graph.ts` is the single mapping boundary to camelCase (`docCount`, `documentId`). The React layer only sees camelCase.
- **Known rough edge to tighten during execution:** `graph_rebuild` job bookkeeping (Task 8 Step 1) — `build_graph` owns its own job row, so the endpoint must NOT also `start_job`; return the previous/last job and let the UI poll. Fix inline when implementing.
