# Accurate Retrieval Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dense-only retriever with a hybrid pipeline — dense + Postgres full-text, fused with RRF, reranked, neighbor-expanded — plus contextual embeddings at ingest, all on the existing Postgres/pgvector stack.

**Architecture:** New pure modules (`fusion.py`, `rerank.py`, `contextualize.py`) are composed by a rewritten `retrieve.py`. Both retrievers share one permission predicate. Providers (rerank, embeddings) keep a deterministic fake fallback so the whole pipeline runs offline. Spec: `docs/superpowers/specs/2026-07-18-accurate-retrieval-pipeline-design.md`.

**Tech Stack:** Python 3.12, FastAPI, psycopg3, pgvector, Postgres full-text (GIN); Next/Drizzle for the one schema migration.

## Global Constraints

- Everything must run with **no network and no GPU**: when `use_real_models()` is false, embeddings and rerank fall back to deterministic fakes; `pytest` stays green offline.
- The permission predicate is authored **once** and reused by both retrievers (dense + lexical). No second copy.
- `chunks.text` keeps storing the **raw** span (citations/highlighting depend on exact offsets). Only the embedded representation changes.
- Defaults (engine/app/settings.py): `retrieval_n_vec=40`, `retrieval_n_lex=40`, `rrf_k=60`, `rerank_in=20`, `final_k=8`, `doc_cap=3`, `contextual_mode="header"`, `rerank_base_url=""`, `rerank_model=""`.
- Every stage is config-toggleable back to today's dense-only behavior.
- Log the change in `CHANGELOG.md` under `[Unreleased]` in the same commit (per CLAUDE.md).
- Run engine tests from `engine/` with `uv run pytest -q`.

---

### Task 1: RRF fusion (pure function)

**Files:**
- Create: `engine/app/ask/fusion.py`
- Test: `engine/tests/test_fusion.py`

**Interfaces:**
- Produces: `rrf(lists: list[list[str]], k: int = 60, weights: list[float] | None = None) -> list[tuple[str, float]]` — input lists are chunk-ids in best-first order; returns `(chunk_id, score)` sorted desc. `cap_by_document(ranked: list[str], chunk_to_doc: dict[str, str], cap: int) -> list[str]`.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_fusion.py
from app.ask.fusion import rrf, cap_by_document


def test_rrf_consensus_beats_single_top():
    # 'b' is #2 in both lists; 'a' is #1 in one, absent in the other.
    fused = rrf([["a", "b", "c"], ["d", "b", "a"]], k=60)
    order = [cid for cid, _ in fused]
    assert order[0] == "b"  # consensus across both lists wins


def test_rrf_scores_use_one_based_rank():
    fused = dict(rrf([["a"]], k=60))
    assert abs(fused["a"] - 1.0 / 61) < 1e-9  # weight 1.0 / (60 + rank=1)


def test_rrf_weights_respected():
    fused = dict(rrf([["a"], ["b"]], k=60, weights=[2.0, 1.0]))
    assert fused["a"] > fused["b"]


def test_cap_by_document_limits_one_doc():
    ranked = ["c1", "c2", "c3", "c4"]
    doc = {"c1": "D", "c2": "D", "c3": "D", "c4": "E"}
    assert cap_by_document(ranked, doc, cap=2) == ["c1", "c2", "c4"]
```

- [ ] **Step 2: Run it, expect failure** — `uv run pytest tests/test_fusion.py -q` → ImportError.

- [ ] **Step 3: Implement**

```python
# engine/app/ask/fusion.py
def rrf(
    lists: list[list[str]],
    k: int = 60,
    weights: list[float] | None = None,
) -> list[tuple[str, float]]:
    """Reciprocal rank fusion (Cormack et al., 2009). Each list is chunk-ids in
    best-first order. score(d) = Σ weight_L / (k + rank_L(d)), rank 1-based."""
    ws = weights or [1.0] * len(lists)
    scores: dict[str, float] = {}
    for lst, w in zip(lists, ws):
        for rank0, cid in enumerate(lst):
            scores[cid] = scores.get(cid, 0.0) + w / (k + rank0 + 1)
    return sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))


def cap_by_document(ranked: list[str], chunk_to_doc: dict[str, str], cap: int) -> list[str]:
    """Keep order but let each document contribute at most `cap` chunks."""
    seen: dict[str, int] = {}
    out: list[str] = []
    for cid in ranked:
        doc = chunk_to_doc.get(cid, cid)
        if seen.get(doc, 0) >= cap:
            continue
        seen[doc] = seen.get(doc, 0) + 1
        out.append(cid)
    return out
```

- [ ] **Step 4: Run tests, expect pass** — `uv run pytest tests/test_fusion.py -q`.

- [ ] **Step 5: Commit** — `git add engine/app/ask/fusion.py engine/tests/test_fusion.py && git commit -m "Engine: RRF fusion + per-document cap (pure, TDD)"`

---

### Task 2: Contextual embedding text (pure function)

**Files:**
- Create: `engine/app/ingest/contextualize.py`
- Test: `engine/tests/test_contextualize.py`

**Interfaces:**
- Produces: `contextualize(text: str, filename: str, page: int | None, mode: str = "header") -> str`. `mode="off"` returns `text` unchanged; `mode="header"` prepends a `filename · p.N` header.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_contextualize.py
from app.ingest.contextualize import contextualize


def test_off_returns_raw():
    assert contextualize("body", "f.pdf", 3, mode="off") == "body"


def test_header_prepends_filename_and_page_and_keeps_body():
    out = contextualize("body text", "deploy.pdf", 3, mode="header")
    assert out.startswith("deploy.pdf")
    assert "p.3" in out
    assert out.endswith("body text")


def test_header_without_page():
    out = contextualize("body", "notes.txt", None, mode="header")
    assert "notes.txt" in out and "body" in out and "p." not in out
```

- [ ] **Step 2: Run it, expect failure.**

- [ ] **Step 3: Implement**

```python
# engine/app/ingest/contextualize.py
def contextualize(text: str, filename: str, page: int | None, mode: str = "header") -> str:
    """Enrich a chunk BEFORE embedding while the raw `text` is stored for
    citation. 'header' prepends a source line so short chunks carry provenance
    signal (Anthropic contextual retrieval, lightweight variant)."""
    if mode == "off":
        return text
    head = filename if page is None else f"{filename} · p.{page}"
    return f"{head}\n\n{text}"
```

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Commit** — `"Engine: contextualize() for enriched embeddings (TDD)"`

---

### Task 3: Rerank providers

**Files:**
- Create: `engine/app/ask/rerank.py`
- Test: `engine/tests/test_rerank.py`

**Interfaces:**
- Consumes: `settings` (`rerank_base_url`, `rerank_model`, `llm_model`, `openai_api_key`, `models_base_url`) and `use_real_models()`.
- Produces: `@dataclass RerankItem(chunk_id: str, text: str)`; `rerank(query: str, items: list[RerankItem], top_k: int) -> list[str]` (returns chunk-ids best-first); internal `FakeReranker`, `LLMReranker`, `CrossEncoderReranker`; `get_reranker()`.

- [ ] **Step 1: Write the failing test**

```python
# engine/tests/test_rerank.py
from app.ask.rerank import RerankItem, FakeReranker, LLMReranker


def test_fake_preserves_order_and_truncates():
    items = [RerankItem(f"c{i}", f"t{i}") for i in range(5)]
    assert FakeReranker().rerank("q", items, top_k=3) == ["c0", "c1", "c2"]


def test_llm_reranker_parses_scored_indices():
    items = [RerankItem("a", "x"), RerankItem("b", "y"), RerankItem("c", "z")]
    # Model returns 1-based indices, best first; we keep top_k.
    r = LLMReranker(call=lambda prompt: '[{"index": 3, "score": 9}, {"index": 1, "score": 4}]')
    assert r.rerank("q", items, top_k=2) == ["c", "a"]


def test_llm_reranker_falls_back_to_identity_on_bad_json():
    items = [RerankItem("a", "x"), RerankItem("b", "y")]
    r = LLMReranker(call=lambda prompt: "not json")
    assert r.rerank("q", items, top_k=2) == ["a", "b"]
```

- [ ] **Step 2: Run it, expect failure.**

- [ ] **Step 3: Implement**

```python
# engine/app/ask/rerank.py
import json
import re
from dataclasses import dataclass
from typing import Callable, Protocol

import httpx

from ..settings import settings, use_real_models


@dataclass
class RerankItem:
    chunk_id: str
    text: str


class Reranker(Protocol):
    def rerank(self, query: str, items: list[RerankItem], top_k: int) -> list[str]: ...


class FakeReranker:
    """Identity: keep fusion order, truncate. Used offline and in tests."""

    def rerank(self, query: str, items: list[RerankItem], top_k: int) -> list[str]:
        return [it.chunk_id for it in items[:top_k]]


_RERANK_PROMPT = (
    "You are a reranker. Given a question and numbered candidate passages, return the "
    "passages most likely to answer the question, best first. Respond ONLY with a JSON "
    "array of objects {{\"index\": <1-based int>, \"score\": <0-10>}}. Question: {q}\n\n{cands}"
)


class LLMReranker:
    """One batched chat call scores candidates. `call` is injected for tests; in
    production it posts to the configured chat endpoint."""

    def __init__(self, call: Callable[[str], str] | None = None) -> None:
        self._call = call or self._http_call

    def _http_call(self, prompt: str) -> str:
        headers = (
            {"Authorization": f"Bearer {settings.openai_api_key}"}
            if settings.openai_api_key
            else {}
        )
        r = httpx.post(
            f"{settings.models_base_url.rstrip('/')}/chat/completions",
            json={
                "model": settings.llm_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0,
            },
            headers=headers,
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

    def rerank(self, query: str, items: list[RerankItem], top_k: int) -> list[str]:
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
                return order[:top_k]
        except Exception:  # noqa: BLE001 — never let reranking break the answer
            pass
        return [it.chunk_id for it in items[:top_k]]


class CrossEncoderReranker:
    """Cohere/Jina/TEI-style POST {base}/rerank — for a self-hosted bge-reranker."""

    def rerank(self, query: str, items: list[RerankItem], top_k: int) -> list[str]:
        try:
            r = httpx.post(
                f"{settings.rerank_base_url.rstrip('/')}/rerank",
                json={
                    "model": settings.rerank_model,
                    "query": query,
                    "documents": [it.text for it in items],
                    "top_n": top_k,
                },
                timeout=60,
            )
            r.raise_for_status()
            results = r.json()["results"]
            return [items[row["index"]].chunk_id for row in results][:top_k]
        except Exception:  # noqa: BLE001
            return [it.chunk_id for it in items[:top_k]]


def get_reranker() -> Reranker:
    if settings.rerank_base_url:
        return CrossEncoderReranker()
    if use_real_models():
        return LLMReranker()
    return FakeReranker()
```

- [ ] **Step 4: Run tests, expect pass.**

- [ ] **Step 5: Commit** — `"Engine: rerank providers (fake/LLM/cross-encoder, TDD)"`

---

### Task 4: Retrieval settings

**Files:**
- Modify: `engine/app/settings.py`

**Interfaces:**
- Produces on `settings`: `retrieval_n_vec:int=40`, `retrieval_n_lex:int=40`, `rrf_k:int=60`, `rerank_in:int=20`, `final_k:int=8`, `doc_cap:int=3`, `rerank_base_url:str=""`, `rerank_model:str=""`, `contextual_mode:str="header"`.

- [ ] **Step 1: Add fields** to the `Settings` class (after `embed_dim`):

```python
    # --- Retrieval pipeline ---
    retrieval_n_vec: int = 40   # dense candidate pool
    retrieval_n_lex: int = 40   # lexical candidate pool
    rrf_k: int = 60             # RRF smoothing constant
    rerank_in: int = 20         # candidates sent to the reranker
    final_k: int = 8            # chunks kept for the answer
    doc_cap: int = 3            # max chunks one document contributes to fusion
    rerank_base_url: str = ""   # self-hosted cross-encoder reranker; empty → LLM/fake
    rerank_model: str = ""
    contextual_mode: str = "header"  # off | header | llm
```

- [ ] **Step 2: Verify import** — `uv run python -c "from app.settings import settings; print(settings.final_k, settings.contextual_mode)"` → `8 header`.

- [ ] **Step 3: Commit** — `"Engine: retrieval pipeline settings"`

---

### Task 5: Full-text GIN index (schema migration)

**Files:**
- Modify: `web/lib/db/schema.ts` (add an expression GIN index to `chunks`)
- Create: `web/lib/db/migrations/0006_*.sql` (via `drizzle-kit generate`)

**Interfaces:**
- Produces: a GIN index `chunks_content_tsv_idx` on `to_tsvector('english', text)` so lexical search is indexed. No new column — avoids typing `tsvector` in Drizzle.

- [ ] **Step 1: Add the expression index** to the `chunks` table's index list in `web/lib/db/schema.ts`. Ensure `sql` is imported from `drizzle-orm`:

```ts
// at top, alongside the other drizzle-orm import:
import { sql } from 'drizzle-orm'

// inside the chunks table's (t) => [ ... ] index array, add:
    index('chunks_content_tsv_idx')
      .using('gin', sql`to_tsvector('english', ${t.text})`),
```

- [ ] **Step 2: Generate the migration**

Run (from `web/`): `npm run db:generate`
Expected: a new file `web/lib/db/migrations/0006_*.sql` containing
`CREATE INDEX ... USING gin (to_tsvector('english', "text"))` and an updated `_journal.json`.

- [ ] **Step 3: Apply it**

Run (from `web/`, with `DATABASE_URL` set): `npm run db:migrate`
Expected: migration `0006` applied, exit 0.

- [ ] **Step 4: Verify the index exists**

Run: `psql "$DATABASE_URL" -c "\di chunks_content_tsv_idx"`
Expected: one row, `gin`.

- [ ] **Step 5: Commit** — `git add web/lib/db/schema.ts web/lib/db/migrations && git commit -m "Schema: GIN full-text index on chunks for lexical retrieval"`

---

### Task 6: Lexical retriever + shared permission predicate

**Files:**
- Modify: `engine/app/ask/retrieve.py`
- Test: `engine/tests/test_retrieve.py` (add a lexical-hit case)

**Interfaces:**
- Produces (module-internal): `_perm_sql() -> str` returning the reusable predicate fragment `"( %s OR EXISTS (SELECT 1 FROM document_groups dg WHERE dg.document_id = c.document_id AND dg.group_id = ANY(%s::uuid[])) )"`; `_dense_ids(conn, ws, qvec_lit, all_access, gids, n) -> list[str]`; `_lexical_ids(conn, ws, query, all_access, gids, n) -> list[str]`.
- `Retrieved` gains a field `context: str` (defaults to `text`) used by the answerer; `text` stays the matched span for citations.

- [ ] **Step 1: Write the failing test** (append to `engine/tests/test_retrieve.py`)

```python
def test_lexical_retrieves_exact_token_without_semantic_overlap():
    # FakeEmbeddings is not semantic, so a hit here can only come from full-text.
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            _seed_doc(conn, ws, "the flag CKPT_PREFETCH controls warmup")
            _seed_doc(conn, ws, "unrelated content about weather")
    try:
        hits = retrieve(str(ws), "CKPT_PREFETCH", k=5, all_access=True)
        assert any("CKPT_PREFETCH" in h.text for h in hits)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
```

- [ ] **Step 2: Run it, expect failure** — `uv run pytest tests/test_retrieve.py -q` (skips without DB; with DB it fails — dense-only + fake embeddings won't reliably surface the token).

- [ ] **Step 3: Refactor `retrieve.py`** — replace the file body below the `Retrieved` dataclass. Add `context` to the dataclass and split the two retrievers sharing `_perm_sql()`:

```python
from dataclasses import dataclass, field

from ..db import get_conn
from ..ingest.embed import get_provider
from ..settings import settings


@dataclass
class Retrieved:
    chunk_id: str
    document_id: str
    filename: str
    page: int | None
    char_start: int | None
    char_end: int | None
    text: str            # the matched span — citations/highlighting use this
    score: float
    context: str = ""    # expanded text for the answerer; defaults to `text`


def _perm_sql() -> str:
    # ONE permission predicate, reused by both retrievers. Params: (all_access, gids).
    return (
        "( %s OR EXISTS (SELECT 1 FROM document_groups dg "
        "WHERE dg.document_id = c.document_id AND dg.group_id = ANY(%s::uuid[])) )"
    )


def _dense_ids(conn, ws, qvec_lit, all_access, gids, n) -> list[str]:
    rows = conn.execute(
        "SELECT c.id FROM chunks c "
        "WHERE c.workspace_id = %s AND c.embedding IS NOT NULL AND " + _perm_sql() +
        " ORDER BY c.embedding <=> %s::vector LIMIT %s",
        (ws, all_access, gids, qvec_lit, n),
    ).fetchall()
    return [str(r[0]) for r in rows]


def _lexical_ids(conn, ws, query, all_access, gids, n) -> list[str]:
    rows = conn.execute(
        "SELECT c.id FROM chunks c "
        "WHERE c.workspace_id = %s "
        "  AND to_tsvector('english', c.text) @@ plainto_tsquery('english', %s) AND " + _perm_sql() +
        " ORDER BY ts_rank_cd(to_tsvector('english', c.text), plainto_tsquery('english', %s)) DESC "
        "LIMIT %s",
        (ws, query, all_access, gids, query, n),
    ).fetchall()
    return [str(r[0]) for r in rows]
```

- [ ] **Step 4: Implement the composed `retrieve()`** (same file) — dense + lexical + RRF + cap + rerank + neighbor expansion:

```python
from .fusion import rrf, cap_by_document
from .rerank import RerankItem, get_reranker


def retrieve(
    workspace_id: str,
    query: str,
    k: int | None = None,
    group_ids: list[str] | None = None,
    all_access: bool = False,
) -> list[Retrieved]:
    final_k = k or settings.final_k
    gids = group_ids or []
    qvec = get_provider().embed([contextualize_query(query)])[0]
    qlit = "[" + ",".join(str(x) for x in qvec) + "]"

    conn = get_conn()
    try:
        dense = _dense_ids(conn, workspace_id, qlit, all_access, gids, settings.retrieval_n_vec)
        lexical = _lexical_ids(conn, workspace_id, query, all_access, gids, settings.retrieval_n_lex)
        fused = [cid for cid, _ in rrf([dense, lexical], k=settings.rrf_k)]
        if not fused:
            return []

        meta = _fetch_meta(conn, workspace_id, fused)  # id -> row dict, only visible rows
        chunk_to_doc = {cid: meta[cid]["document_id"] for cid in fused if cid in meta}
        capped = cap_by_document([c for c in fused if c in meta], chunk_to_doc, settings.doc_cap)
        candidates = capped[: settings.rerank_in]

        ranked_ids = get_reranker().rerank(
            query, [RerankItem(c, meta[c]["text"]) for c in candidates], final_k
        )
        results = [_to_retrieved(meta[c]) for c in ranked_ids if c in meta]
        _expand_neighbors(conn, workspace_id, results, meta)
        return results
    finally:
        conn.close()
```

Add the helpers `contextualize_query` (returns the query unchanged for now — a hook for future query rewriting), `_fetch_meta` (one `SELECT ... WHERE c.id = ANY(%s::uuid[]) AND c.workspace_id = %s` joining `documents` for filename; returns dict keyed by id with `document_id, filename, page, char_start, char_end, text, ordinal`), `_to_retrieved(row)` (builds `Retrieved` with `score=0.0`, `context=row["text"]`), and `_expand_neighbors` (Step 5).

- [ ] **Step 5: Implement `_expand_neighbors`** — attach ordinal±1 text as `context` (citations unchanged):

```python
def _expand_neighbors(conn, ws, results: list[Retrieved], meta: dict) -> None:
    for r in results:
        ordinal = meta[r.chunk_id]["ordinal"]
        rows = conn.execute(
            "SELECT ordinal, text FROM chunks "
            "WHERE workspace_id = %s AND document_id = %s AND ordinal BETWEEN %s AND %s "
            "ORDER BY ordinal",
            (ws, r.document_id, ordinal - 1, ordinal + 1),
        ).fetchall()
        r.context = "\n".join(t for _, t in rows) if rows else r.text
```

- [ ] **Step 6: Run tests, expect pass** — `uv run pytest tests/test_retrieve.py tests/test_fusion.py -q` (with DB for the retrieve tests; the offline suite still skips them).

- [ ] **Step 7: Commit** — `"Engine: hybrid retrieve — dense+lexical, RRF, cap, rerank, neighbor expansion"`

---

### Task 7: Answer over expanded context

**Files:**
- Modify: `engine/app/ask/answer.py`
- Test: `engine/tests/test_answer.py` (unchanged behavior; add one assertion)

**Interfaces:**
- Consumes: `Retrieved.context`. `_context_block` uses `r.context or r.text`; citation snippet still comes from `r.text`.

- [ ] **Step 1: Update `_context_block`**

```python
def _context_block(retrieved: list[Retrieved]) -> str:
    return "\n\n".join(f"[{i}] {r.context or r.text}" for i, r in enumerate(retrieved, start=1))
```

- [ ] **Step 2: Add a test** (append to `test_answer.py`) proving citation snippet uses matched `text`, not expanded `context`:

```python
def test_citation_snippet_uses_matched_text_not_expanded_context():
    r = Retrieved("chunk-1", "doc-1", "f.txt", 1, 0, 5, "MATCH", 0.9, context="NEIGHBOR MATCH NEIGHBOR")
    out = answer_question("what?", [r])
    assert out.citations[0].snippet.startswith("MATCH")
```
(Import `Retrieved` from `app.ask.retrieve` at the top of the test.)

- [ ] **Step 3: Run tests, expect pass** — `uv run pytest tests/test_answer.py -q`.

- [ ] **Step 4: Commit** — `"Engine: answerer reads expanded context, cites matched span"`

---

### Task 8: Contextual embeddings at ingest

**Files:**
- Modify: `engine/app/ingest/store.py`

**Interfaces:**
- Consumes: `contextualize` (Task 2), `settings.contextual_mode`. Embeds `contextualize(chunk.text, filename, page, mode)` while storing `chunk.text` raw.

- [ ] **Step 1: Change the embed call** in `process_document`. Replace:

```python
        vectors = get_provider().embed([c.text for c in chunks]) if chunks else []
```
with:

```python
        from .contextualize import contextualize
        from ..settings import settings

        embed_inputs = [
            contextualize(c.text, filename, c.page, settings.contextual_mode) for c in chunks
        ]
        vectors = get_provider().embed(embed_inputs) if chunks else []
```
(The `INSERT INTO chunks ... text ...` still uses `c.text` — raw — unchanged.)

- [ ] **Step 2: Verify no regression** — `uv run pytest -q` (store has no offline unit test; the import + fake-embed path must not error). Also `uv run python -c "from app.ingest.store import process_document"` imports clean.

- [ ] **Step 3: Commit** — `"Engine: embed contextualized chunks (store raw text for citations)"`

---

### Task 9: Full suite, docs, changelog

**Files:**
- Modify: `CHANGELOG.md`, `engine/.env`-facing docs in `.env.example`

- [ ] **Step 1: Add reranker + contextual vars to `.env.example`** (under the models block):

```
# --- Retrieval (optional; sensible defaults in engine/app/settings.py) ---
# Self-hosted cross-encoder reranker (e.g. bge-reranker). Empty → LLM reranker
# when a model is configured, else no-op.
RERANK_BASE_URL=
RERANK_MODEL=
# Chunk enrichment before embedding: off | header | llm
CONTEXTUAL_MODE=header
```

- [ ] **Step 2: Update CHANGELOG `[Unreleased]`** — add under `### Changed`:

```
- Retrieval is now a hybrid pipeline: dense (pgvector) + Postgres full-text, fused with
  RRF, reranked (LLM or self-hosted cross-encoder), and neighbor-expanded. Chunks are
  embedded with a contextual header. One permission predicate serves both retrievers.
```

- [ ] **Step 3: Run the whole engine suite** — `cd engine && uv run pytest -q`. Expected: all prior tests + new `test_fusion`, `test_contextualize`, `test_rerank` pass; DB-gated retrieve tests pass with `DATABASE_URL` set, skip without.

- [ ] **Step 4: Commit** — `"Docs: retrieval pipeline env + changelog"`

---

## Self-Review

- **Spec coverage:** hybrid (Tasks 5,6) · RRF (1,6) · rerank (3,6) · neighbor expansion (6,7) · contextual embeddings (2,8) · one permission predicate (6) · settings (4) · offline fakes (3,8). All spec sections map to a task.
- **Placeholder scan:** none — pure functions have full code; SQL is complete; `_fetch_meta`/`_to_retrieved`/`contextualize_query` are specified with exact behavior in Task 6 Step 4.
- **Type consistency:** `Retrieved` gains `context: str` in Task 6 and is consumed in Task 7; `RerankItem(chunk_id, text)` defined in Task 3 and constructed in Task 6; `rrf`/`cap_by_document` signatures match between Task 1 and Task 6.
- **Risk:** the expression GIN index (Task 5) must exactly match the `to_tsvector('english', c.text)` in the lexical query (Task 6) or Postgres won't use the index — both pinned to `'english'`. Re-ingest is required for contextual embeddings to take effect on existing docs (pre-launch, acceptable).
