# Accurate Retrieval Pipeline — design

**Date:** 2026-07-18
**Status:** Approved (decisions locked). Awaiting spec review before planning.
**Source of ideas:** Cerebras, *How We Built Our Knowledge Base*
(https://www.cerebras.ai/blog/how-we-built-our-knowledge-base). Note: that system runs
**entirely on PostgreSQL** — its accuracy comes from the retrieval pipeline, not the vector
store. This spec copies the pipeline; it explicitly does **not** adopt Qdrant.

**Locked decisions:** stay on Postgres + pgvector · build hybrid+RRF, reranking, neighbor
expansion, and contextual embeddings.

## Why

Today `engine/app/ask/retrieve.py` does a single dense (vector-only) search with a top-k
cosine query. Dense-only misses exact tokens (error strings, flags, part numbers, codes) —
exactly the terms enterprise users search for — and returns lonely chunks with split-off
headings. The blog's fix is a layered pipeline; we adopt it on our existing stack.

## Target pipeline

```
query
 ├─(A) dense retriever   : pgvector cosine        → top N_vec (40)   ┐ both
 └─(B) lexical retriever : Postgres FTS (GIN)     → top N_lex (40)   ┘ permission-filtered
        │
   RRF fusion  score(d)=Σ 1/(60+rank_L(d))  ·  dedupe by chunk  ·  cap per-document
        │  → fused top 20
   Rerank  (query, 20 candidates) → scores → keep top K (8–10)
        │
   Neighbor expansion  attach ordinal±1 chunks of each winner (context only)
        │
   Answer  (existing answer.py) over the expanded, cited context
```

Every stage before "Answer" already exists partially; we are adding B, fusion, rerank, and
expansion, and enriching what we embed.

### A. Dense retriever (exists, refactored)
Keep the pgvector cosine query. Return `(chunk_id, doc_id, …, score, rank)`; raise the
internal candidate pool to `N_vec` (default 40) so fusion has material to work with.

### B. Lexical retriever (new)
Postgres full-text search over chunk text:
`WHERE content_tsv @@ plainto_tsquery('english', $q)` ranked by `ts_rank_cd`, top `N_lex`.
Requires a generated `tsvector` column + GIN index (see Schema). Same permission predicate
as A (see "One access predicate").

### Fusion (new — pure function, unit-tested)
`rrf(lists, k=60, weight=1.0)`: for each doc, `Σ weight/(k + rank)` across the lists it
appears in; sort desc. Then **dedupe** by `chunk_id` and **cap** how many chunks one
document contributes (default 3) so a single long doc can't monopolize the top 20. Output:
fused top `RERANK_IN` (default 20).

### Rerank (new — provider seam, like the model providers)
`RerankProvider.rerank(query, candidates) -> ranked candidates with scores`, keep top
`FINAL_K` (default 8). Three implementations, selected by config, with a safe fallback:
- **FakeReranker** — returns fusion order unchanged. Used in tests / when nothing else is
  configured, so the pipeline always runs offline.
- **LLMReranker** *(default when a real model is configured)* — one batched chat call to the
  configured LLM (`gpt-5.4-nano` by default): given the query and the 20 candidates, return
  the top K with 0–10 scores. Cheap on nano; no extra infrastructure.
- **CrossEncoderReranker** — HTTP `POST {RERANK_BASE_URL}/rerank` (Jina/TEI/Cohere-style
  schema) with `RERANK_MODEL` (e.g. a self-hosted `bge-reranker`) for on-prem. Used when
  `RERANK_BASE_URL` is set.

### Neighbor expansion (new)
For each final chunk, fetch same-document `ordinal-1` and `ordinal+1` chunks and concatenate
(in order, deduped) into the context passed to the answerer. **Citations still point to the
matched chunk** — expansion enriches context, it does not add citations. Char offsets are
preserved for the matched chunk so the source viewer highlight is unchanged.

### Contextual embeddings (ingest side — new)
At ingest we embed an *enriched* representation while storing the raw chunk for
display/citation (the blog reports significant accuracy gains from normalizing before
embedding). `contextualize(chunk, document) -> str`, modes by config:
- **`header`** *(default — no LLM cost)*: prepend `"{filename}"` + nearest heading/section
  and page, e.g. `"deploy-runbook.pdf · Backups\n\n{chunk text}"`.
- **`llm`** *(optional)*: one cached LLM call per chunk producing a one-sentence situating
  context (Anthropic contextual retrieval), prepended before embedding.
- **`off`**: embed raw text (today's behavior).

`chunks.text` continues to store the raw span; only the vector changes. `store.py` embeds
`contextualize(c)` instead of `c.text`.

## Schema changes (web/lib/db/schema.ts + a Drizzle migration)

Add to `chunks`:
```sql
content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;
CREATE INDEX chunks_content_tsv_idx ON chunks USING gin (content_tsv);
```
(`web/` still owns the schema until re-arch Step 2; the engine reads the column via raw SQL.)
No change to `EMBED_DIM`. Existing documents must be **re-ingested** to pick up contextual
embeddings + the new 300/50 chunking; acceptable pre-launch.

## One access predicate (consolidation — also re-arch Step 1)

Both retrievers (A and B) must apply the identical permission filter. We factor it into a
single SQL snippet built once in the engine and reused by both queries:
`(all_access OR EXISTS (SELECT 1 FROM document_groups dg WHERE dg.document_id=c.document_id
AND dg.group_id = ANY(:gids)))`. This removes the last duplication risk in retrieval and is
a down payment on re-architecture Step 1 (engine owns the single access rule).

## Config (engine/app/settings.py)

| Setting | Default | Meaning |
|---|---|---|
| `retrieval_n_vec` | 40 | dense candidate pool |
| `retrieval_n_lex` | 40 | lexical candidate pool |
| `rrf_k` | 60 | RRF smoothing constant |
| `rerank_in` | 20 | candidates sent to reranker |
| `final_k` | 8 | chunks kept for the answer |
| `doc_cap` | 3 | max chunks one document contributes to fusion |
| `rerank_base_url` / `rerank_model` | "" | cross-encoder reranker; empty → LLM or fake |
| `contextual_mode` | `header` | `off` \| `header` \| `llm` |

## Testing (TDD)

- **RRF** — pure function: fixed input lists → known fused order; consensus beats a single
  #1; weights and `k` respected.
- **doc cap / dedupe** — a document flooding candidates is capped; duplicate chunk ids merge.
- **contextualize(header)** — pure function: output begins with filename/section, contains
  raw text.
- **RerankProvider (fake)** — pipeline keeps fusion order; **LLMReranker** parsing tested
  against a canned model response.
- **neighbor expansion** — given a chunk with neighbors, context includes ordinal±1 in order;
  citations unchanged.
- **lexical + hybrid** — integration tests behind the existing DB-gated (skipped-without-DB)
  markers, mirroring current `test_retrieve` style.

## Non-goals (deliberately deferred)

- Qdrant / any second datastore.
- IDF and age-decay scorers (blog has them; low ROI for static uploaded docs — revisit).
- Planner→executor→synthesizer agentic routing, MCP retrieval primitives, "who_knows",
  projects-as-scope — roadmap, not this spec.
- Query rewriting / HyDE.
- Changing the embedding model/dimension (separate decision).

## Success criteria

- A query for an exact token present in a document (a flag, code, filename) retrieves that
  document even with no semantic overlap — proving lexical + fusion work.
- The permission predicate exists in exactly one place, used by both retrievers.
- Reranking and neighbor expansion are on by default with a real model; the whole pipeline
  still runs offline (fakes) so tests need no network or GPU.
- Turning each stage off via config reproduces today's dense-only behavior (safe rollback).
