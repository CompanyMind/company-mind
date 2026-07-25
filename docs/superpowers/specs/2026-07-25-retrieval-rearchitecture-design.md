# Retrieval & Ingestion Re-architecture — design

**Date:** 2026-07-25
**Status:** Approved (design accepted). Awaiting spec review before planning.
**Supersedes in part:** `2026-07-18-accurate-retrieval-pipeline-design.md` — that spec's pipeline
(hybrid + RRF + rerank + neighbour expansion + contextual embeddings) shipped, and its *shape* is
retained. This document fixes what it got wrong, and replaces the representation underneath it.

**Evidence base:** a 24-agent research run (2026-07-25) — 12 web-research sweeps, 2 independent code
audits, 3 competing target architectures, 6 adversarial critiques, 1 synthesis. Every load-bearing
claim about this codebase below was re-verified by hand against the working tree. Sources are indexed
at the end; numbers taken from vendor blogs rather than peer-reviewed benchmarks are marked as such.

---

## 1. Why

The founder's complaint: retrieval is "not efficient and accurate in the sense I wanted", and the
product must "handle any data format like audio, docs, pdf, excel, powerpoint, image and so on".

Both halves have the same root cause, and it is not the retrieval algorithm.

### 1.1 The structural cause: a citation is the wrong type

`extract_text(filename, mime, data) -> ParsedDoc(text: str, pages: list[Page])`
(`engine/app/ingest/parse.py:42`) has a codomain of *one string plus page char-ranges*. Every
citation in the product is therefore `(page: int, char_start: int, char_end: int)`.

- A spreadsheet citation is `(sheet, "B12:F47")`.
- An audio citation is `(t_start_ms, t_end_ms, speaker)`.
- A scan citation is `(page, bbox)`.
- A slide citation is `(slide_id, shape_id)`.

None of these is an integer offset into a string. You cannot extend a function's codomain by adding
columns to its consumers. **Every format bolted onto the current signature must flatten into that
string and destroy the anchor that citations exist to preserve** — i.e. we would ship "handles any
format" while breaking the one property the product is sold on. This is why "any format" and "cite
the exact source" are currently mutually exclusive here.

A second consequence, already live: because `chunks.char_start/char_end` *is* the citation, changing
the chunk window invalidates every stored citation in the corpus.

### 1.2 The accuracy causes, verified in code

| # | Defect | Location | Consequence |
|---|---|---|---|
| 1 | `plainto_tsquery` **ANDs every term**, used as a hard `WHERE` filter | `ask/retrieve.py:50` | A ten-content-word question needs all ten lemmas inside one 300-word chunk. For most natural-language questions the lexical arm returns **zero rows**, and equal-weight RRF silently collapses to dense-only. |
| 2 | `to_tsvector('english', …)` applied to Russian and Uzbek text | `ask/retrieve.py:50-51`, `schema.ts:124` | The English snowball stemmer is a no-op on Cyrillic, so «договор» cannot match «договора» in a six-case language. Half of "hybrid" retrieval has been dead in 2 of 3 target languages since migration `0006`. |
| 3 | HNSW scanned with an inline permission `EXISTS`; `hnsw.ef_search` and `hnsw.iterative_scan` never set anywhere in the repo | `ask/retrieve.py:36-43` | pgvector's own README: with `ef_search=40` and a 10%-selective filter, ~4 of 40 rows survive. Our `LIMIT` is 40 and `ef_search` defaults to 40. **Conditional** — as owner, `_perm_sql()` short-circuits to `TRUE`, so this may be inert at today's scale and must be probed before it is fixed. |
| 4 | Cross-encoder reranker POSTs Cohere-shaped JSON; TEI answers 422; `except Exception: pass` swallows it | `ask/rerank.py:82-98` | Reranking can silently never run, with no log line. The LLM reranker's greedy `re.search(r"\[.*\]")` and unbounded `order[:top_k]` have the same failure character. |
| 5 | `cap_by_document` runs **before** the reranker | `ask/retrieve.py:125` | A diversity control is acting as a hard recall ceiling on the candidate set. |
| 6 | Equal-weight RRF over a frequently-empty lexical list | `ask/fusion.py`, `retrieve.py:118` | A rank-1 hit from a near-empty, IDF-less lexical list scores the same `1/(k+1)` as the best dense hit. `fusion.py` already accepts a `weights` argument it is never passed. |
| 7 | `python-docx` `d.paragraphs` only | `ingest/parse.py:58` | **Every table, header, footer, footnote and text box in every .docx is silently dropped.** |
| 8 | `pypdf.extract_text()`, no OCR, no layout | `ingest/parse.py:51` | A scanned PDF yields `""` and is marked `status='indexed'`, `error=NULL`. |
| 9 | `CONTEXTUAL_MODE=llm` documented but unimplemented | `settings.py:36`, `ingest/contextualize.py` | Silently degrades to the filename header. |
| 10 | Accidental Matryoshka truncation | `settings.py:22-25`, `ingest/embed.py:53` | `text-embedding-3-small` is natively 1536-dim; `dimensions: 1024` is sent unconditionally. Retrieval is the most compression-sensitive MTEB task family. |
| 11 | No evaluation, no CI | `.github` does not exist; all 10 DB-touching tests are `skipif(not DATABASE_URL)` | `uv run pytest` exits 0 having verified nothing about retrieval — **including the permission-filter test**. Every claim above and below is unfalsifiable until this changes. |

### 1.3 Two data-destroying bugs (fix immediately, independent of this design)

1. **Re-ingest destroys the evidence for every past answer.** `citations.chunk_id` and
   `citations.document_id` are both `ON DELETE cascade` (migration `0002:44-45`), while
   `ingest/store.py:52` runs `DELETE FROM chunks WHERE document_id=…` on every re-ingest.
   Re-uploading a revised policy — the most routine operation in this product — silently deletes the
   citation rows of every historical answer that cited it, while the `[1]`/`[2]` markers keep
   rendering in `messages.content`. In a product sold on auditability this is destruction of the
   evidence we are paid to produce.
2. **`embed.py:59` assumes response order**, ignoring each row's `index`. One reordered batch pairs
   every chunk with the wrong vector, silently. Compounded by there being no batching at all: TEI's
   default `max-client-batch-size` is 32, so any document over roughly 16 pages **fails today**
   against a stock self-hosted embedder.

### 1.4 Efficiency defects

- `ingest/store.py:26` holds a pooled connection (`max_size=10`) across the embedding HTTP call.
  Ten concurrent uploads drain the pool and every `/ask`, Telegram poll and Atlas request times out.
- No `chunks(document_id, ordinal)` index exists; `_expand_neighbors` (`retrieve.py:86-98`) issues
  one query per result (N+1) and re-emits the 50-word overlap into the answer context.
- `graph/store.py:32` loads every chunk embedding in the workspace into Python to compute per-document
  means. `AVG(embedding) … GROUP BY` does this in Postgres.
- `web/app/api/documents/route.ts:29` buffers the whole body via `req.formData()` *before* checking
  `MAX_BYTES`.

---

## 2. The decision

**Rewrite the representation and the ingest path; repair retrieval; keep one Postgres.**

- The **ingest layer is a genuine rewrite** — `parse.py`, `chunk.py`, `contextualize.py`, the embed
  client and the ingest orchestration are replaced outright (~400 of the engine's 2,413 Python lines).
- **Retrieval is emphatically not a rewrite.** Its defects are a GUC, a missing index, a `WHERE`
  clause and one HTTP payload shape. Replacing pgvector with a dedicated engine would fix none of them.
- **The schema is additive-then-cutover**, never a flag day. New tables land alongside the existing
  ones; every current chunk backfills as a `kind='text'` block carrying its present
  `(page, char_start, char_end)`, so historical citations keep resolving byte-identically, and the
  read path flips only after a zero-mismatch reconciliation.

### 2.1 Scope, given the pilot

The first pilot corpus is **native-text PDF/DOCX policies plus Excel and PowerPoint**, in Russian,
Uzbek and English. No scans and no call recordings are in it.

Therefore the critical path needs **no GPU beyond a small embedder + reranker (~5 GB VRAM)**, and two
phases move out of it:

- **OCR / scanned pages — deferred.** Removes PaddleOCR-VL, the compute-capability ≥ 8.0 constraint
  that would disqualify the T4/A10G cards regional customers already own, the raster-on-demand page
  viewer, and the Cyrillic-OCR go/no-go gate. Adding it later is a new `producer` value writing the
  same block schema, not a migration.
- **Audio — deferred.** It remains the differentiator, but it is a sales bet rather than a pilot
  requirement and should not sit on the critical path carrying an unverified model claim (§7.3). The
  `transcript_turn` block kind and its locator shape are defined in the schema from day one so the
  lane plugs in without touching anything else.

Core scope drops from ~33.5 to ~17.5 engineer-weeks.

---

## 3. What we are deliberately not doing

Each of these was proposed, researched, and killed on evidence. They are recorded so they are not
re-litigated.

| Rejected | Why |
|---|---|
| **Visual-first retrieval (ColPali / ColQwen page images) as the primary index** | On **ViDoRe v3 — the ColPali authors' own benchmark** — the best pipeline is text-only (63.6 nDCG@10) vs 57.8 for the best visual one. NVIDIA's ablation puts single-vector + cross-encoder within 1.07 nDCG@10 of late interaction at 1/2312 the storage. Decisively for us: VLM bbox grounding scores **F1 0.089 vs 0.602** for human annotators — a MaxSim heatmap is not a citation a compliance officer can use. It also does nothing for audio or spreadsheets. |
| **A free-running agent loop, reflection, unconditional decomposition** | In the one clean local-7B ablation, plain hybrid scored **EM 55.0 vs 53.2** for the full agentic pipeline. Reflection measured *negative* (0.870→0.781 on a DevOps KB; 0.721→0.666 on MuSiQue at 6× latency). Unconditional decomposition collapsed MuSiQue MRR 0.469→0.102. Also unauditable under EU AI Act Art. 12. |
| **A second datastore (Qdrant / Vespa / Milvus / Elastic / OpenSearch / Turbopuffer)** | Onyx — the closest funded open-source comparable — spent Jan–May 2026 migrating **off** Vespa to cut baseline resource requirements. Milvus standalone needs etcd + MinIO. Elastic gates RRF and rank-vectors behind Platinum. Turbopuffer's BYOC needs a vendor control plane, which is impossible air-gapped. None of our defects is a store defect. |
| **GraphRAG / entity knowledge graph** | ~+3 points on multi-hop (70.27 vs 67.02) and *loses* on single-hop (NQ F1 64.78 plain vs 63.01/61.03/50.27), for 41–57× construction cost, with graphs missing ~34% of answer entities. Atlas already covers the governance-graph need. |
| **RAPTOR / cross-document summary trees** | Killed on soundness, not benchmarks: summary nodes aggregate content across documents with different access groups, and our `document_groups × group_members` model has no ACL that can honestly be assigned to such a node. Serving one is a permission leak. |
| **Semantic / LLM-boundary chunking** | Fixed-size won 3 of 5 datasets in NAACL 2025 Findings with all deltas < 2 F1@5; Chroma measured `KamradtSemanticChunker` with the worst IoU of everything tested (1.5%). LumberChunker took 8.37 h/corpus for a 1.65-point spread. |
| **Late chunking** | +1.4–1.9 nDCG@10 in the authors' own paper, and *not* model-agnostic: an independent reproduction measured BGE-M3 collapsing **0.246 → 0.070 nDCG@5**, because late chunking mean-pools spans while BGE-M3's dense head uses CLS pooling — a silent catastrophic failure. |
| **HyDE / blanket multi-query expansion** | HyDE measured **worse**: 0.544 vs 0.587 Recall@5 on financial text-and-table documents, because hypothetical documents hallucinate plausible-but-wrong figures. A Russian question over a partly-English corpus is structurally the round-trip-translation case, where it measured −11%. |
| **Per-chunk Anthropic-style contextualization as the first enrichment** | Its 35/49/67% figures come from a vendor blog with a private eval set and a non-standard metric; the one independent academic reproduction measured nDCG@5 0.312 → 0.317. The peer-reviewed one-summary-per-document variant achieves most of the benefit at 20–100× lower cost. Do the cheap version, measure, escalate only if the harness says otherwise. |
| **`PARTITION BY LIST (workspace_id)`** | Justified by tenant-deletion ergonomics that do not apply to a single-tenant air-gapped install (deletion is `drop database`). Costs: no `CREATE INDEX CONCURRENTLY` on partitioned tables (every index build becomes an outage), and the app role needs schema `CREATE` (banks refuse). Zero retrieval benefit at one partition. |
| **PG16 → PG18** | Sold on io_uring, which is blocked by Docker's default seccomp profile and by `kernel.io_uring_disabled` on hardened hosts — i.e. exactly the hosts we ship to. The real motivation (pgvector 0.8.3's HNSW-vacuum corruption fix) needs only a pinned digest. |
| **Training our own parser VLM or embedding model** | Apache-2.0 sub-1B specialists currently beat frontier general VLMs on OmniDocBench and are re-released every few weeks. Our GPU hours belong in Uzbek/Russian ASR, a multilingual entailment verifier, and per-deployment reranker/embedder adaptation — the only places compute compounds into something a competitor cannot download. |
| **Any non-commercial or copyleft weight or extension** | jina-embeddings-v3/v4 (CC-BY-NC-4.0), zerank-2, ctxl-rerank-v2, jina-reranker-v3 (CC-BY-NC-4.0), Lynx/HaluBench, Luna-2, ColPali (Gemma Research License), Marker/Surya (GPL + modified OpenRAIL-M with a revenue ceiling), Chunkr (AGPL-3.0), ParadeDB `pg_search` (AGPL-3.0), VectorChord (AGPLv3/ELv2), splade-v3, `lid.176` (CC-BY-SA — use `lingua` for language ID). |
| **Any hosted API on the ingest or answer path** | LlamaParse, Mistral OCR, Textract, Google Document AI, Cohere Rerank, Azure Groundedness Detection, voyage-multimodal, pyannoteAI precision-2. One outbound call from a bank's on-prem deployment kills the deal and cannot be walked back. Enforced by a CI test that runs ingest and ask with egress blocked. |

---

## 4. Target architecture

### 4.1 Topology

One Postgres, unchanged by decision. The **on-prem** service count grows from 4 to 6 (`marketing` is
never shipped to a customer datacenter):

| Service | Status | Role |
|---|---|---|
| `db` | existing | Postgres 16 + pgvector, **pinned by digest** (the `pgvector/pgvector:pg16` rolling tag means two air-gapped installs built a month apart get different versions; ≥ 0.8.3 is required for the HNSW-vacuum corruption fix) |
| `engine` | existing | FastAPI: ask path, library, graph. Must never import Docling. |
| `web`, `bot` | existing | unchanged |
| `marketing` | existing | public site — **not** an on-prem deployable |
| `worker` | **new** | Ingest queue consumer. Separate image: Docling pulls ~2.5 GB of torch. |
| `tei` | **new** | Text Embeddings Inference — embedder, and the reranker if CPU-only. |

No second datastore. No DuckDB. No Redis/Celery.

### 4.2 Representation: blocks and locators

```
parse(document_version) -> list[Block]
```

A **Block** is the unit of *meaning and citation*. A **Chunk** is the unit of *retrieval*. They are
separate, joined by `chunk_blocks`. This is the whole design in one sentence.

```
Block = {
  id, document_version_id, workspace_id,
  kind,            # heading | paragraph | list_item | table | table_row | cell_range
                   # | figure | caption | slide | slide_notes | transcript_turn
                   # | page_header | page_footer | formula
  parent_id,       # block tree: section -> subsection -> paragraph
  ordinal,
  text,            # verbatim, what a citation quotes
  html,            # tables only: preserves structure for the answerer
  lang,            # per-block, detected
  locator jsonb,   # EXACTLY ONE SHAPE PER KIND, JSON-Schema-validated on write
  confidence,      # parser/OCR/ASR confidence; consumed by the UI, see 4.6
  producer         # "docling@2.x" | "calamine" | "python-pptx" | "paddleocr-vl" | "gigaam"
}
```

Locator shapes:

| Kind | Locator | Renders as |
|---|---|---|
| paragraph, heading, list_item | `{charspan:[s,e], page?, section_path:[…]}` | highlighted span, breadcrumb "Policy 4.2, p.17" |
| table, table_row, cell_range | `{sheet, range:"B12:F47", header_row, header_path:["2025","Q3","Revenue"]}` | sheet grid with the range outlined and the header path shown |
| slide, slide_notes | `{slide, slide_id, shape_id, is_notes}` | slide with the shape outlined — `slide_id`, not index, so citations survive deck reordering |
| figure, page (scanned) | `{page, bbox:{l,t,r,b,coord_origin}}` | highlight rectangle over the rendered page *(deferred phase)* |
| transcript_turn | `{t_start_ms, t_end_ms, speaker, channel, speaker_confidence}` | seekable player at `#t=start,end` *(deferred phase)* |

`locator` is validated against a per-kind JSON Schema at write time. Without that it becomes a
dumping ground within a quarter.

### 4.3 Data model

New tables (additive):

```sql
document_versions(
  id, document_id, workspace_id, version, content_hash,
  parser_name, parser_version, ocr_engine, asr_engine,
  doc_summary,                       -- one ~150-char summary, used by SAC (4.4)
  effective_from date, effective_to date, superseded_by,
  status, error, error_stage, created_at,
  UNIQUE(document_id, version))

blocks(
  id, document_version_id, workspace_id, kind, parent_id, ordinal,
  text, html, lang, locator jsonb NOT NULL, confidence real, producer,
  UNIQUE(document_version_id, ordinal))

chunk_blocks(chunk_id, block_id, ord, PRIMARY KEY(chunk_id, block_id))

embeddings(chunk_id, model_id text, dim smallint, vec halfvec(1024),
  PRIMARY KEY(chunk_id, model_id))     -- model_id in the key => reversible swaps

ingest_jobs(
  id, document_version_id, workspace_id, stage, status,
  attempts, next_attempt_at, locked_by, locked_at,
  units_done, units_total, error, error_stage)
```

Changes to `chunks`: add `document_version_id`, `embed_text` (what was *actually* embedded — audit and
reproducibility; **what we embed is never what we display**), `lang`, `ts_config regconfig`, `tsv`
(trigger-populated, **not** `GENERATED`: the text→regconfig cast is not `IMMUTABLE` and Postgres will
reject it), `group_ids uuid[]` + `is_public` (denormalized ACL, trigger-maintained from
`document_groups`, which remains the source of truth), and `token_count` becomes a real tokenizer
count rather than a whitespace-word count.

Drop `documents.extracted_text` (last, after cutover) — it duplicates the entire corpus, and
`library/source.py` currently ships the whole string to render one highlight.

`citations` is rewritten:

```sql
citations(
  id, message_id, workspace_id, marker,
  document_version_id  REFERENCES document_versions ON DELETE SET NULL,
  block_id             REFERENCES blocks            ON DELETE SET NULL,
  chunk_id             REFERENCES chunks            ON DELETE SET NULL,  -- was CASCADE
  locator jsonb NOT NULL,     -- FROZEN SNAPSHOT at answer time
  quoted_text text NOT NULL,  -- verbatim; renders with zero joins
  filename, parser_name, parser_version, confidence, verifier_score)
```

Missing indexes to add: `chunks(document_id, ordinal)`, `citations(chunk_id)`,
`citations(document_id)`, `citations(message_id)`, `document_groups(group_id)`,
`group_members(workspace_id, user_id)`, `query_log(workspace_id, created_at DESC)`, GIN on
`chunks(group_ids)`, per-regconfig partial GIN on `chunks(tsv)`.
Drop `chunks_workspace_idx` — selectivity 1.0 on a single-tenant box, never chosen by the planner,
costs every insert.

**Two known hazards.** (a) `drizzle-orm/pg-core` has no `halfvec` type and no `customType` helper
exists in `web/lib/db/` today — these are hand-written raw-SQL migrations that `drizzle-kit generate`
will fight; budget for it. (b) These tables are *defined* in Drizzle and *consumed* in Python across
two independently-versioned images: ship expand-migrate-contract with an explicit
forward/backward compatibility window.

### 4.4 Ingestion

A durable Postgres queue — `SELECT … FOR UPDATE SKIP LOCKED`, `attempts`, `next_attempt_at`,
`locked_by`/`locked_at` with a lease-expiry sweeper, per-stage checkpoints, a dead-letter state and an
operator requeue action — worked by `worker`, **reading bytes from `storage_key`**, which
`web/lib/storage.ts` already durably writes. Today `main.py:43-46` hands `await file.read()` bytes to a
`BackgroundTask`: a container restart strands documents in `status='parsing'` forever with nothing to
resume from.

Stages: `decode → detect → parse → block → chunk → enrich → embed`.

Parsers, by format:

| Format | Tool | Notes |
|---|---|---|
| DOCX, HTML, CSV, EML, EPUB | **Docling** (MIT), in-process in `worker` | Never `docling-serve`: its chunk endpoints drop bounding boxes (issue #613). Plus a supplementary `python-docx` pass for headers/footers, which Docling ignores (#1756). Probe tracked changes and comments explicitly — for a contract corpus, whether an insertion or a deletion gets inlined is a correctness question. |
| PDF (native text) | Docling | Text-layer yield measured per page; a page below ~50 chars is flagged for the deferred OCR tier rather than silently indexed as empty. |
| XLSX / XLS / XLSB / ODS | **python-calamine** | `skip_empty_area=False` so true A1 addresses survive. Table-region detection, multi-row header unmerge storing both flattened name and header tree, units/currency capture. |
| PPTX | **python-pptx** | Shapes, `GraphicFrame` tables, `ChartData` series, speaker notes. Cited by reorder-stable `slide_id`. |

Chunking: Docling `HybridChunker` over the block tree — section boundaries first, then tokenizer-aware
sizing **using the embedding model's own tokenizer**. Today `token_count` is a whitespace-word count,
so a nominal "300-token" Russian chunk is plausibly 700–900 real tokens and the three languages are
silently chunked at different granularities. Target ~250 tokens, overlap 0–10% (down from 16.7%),
tables never split mid-row with header rows repeated, table serializer overridden to HTML — Docling's
default flat-text table serialization (#3645) is a known quality sink.

Enrichment: `CONTEXTUAL_MODE=llm` — currently documented and silently ignored — becomes
**Summary-Augmented Chunking**: one generic ~150-char summary per document, prepended along with the
heading path into `chunks.embed_text`, while `chunks.text` stays verbatim. This is the peer-reviewed
cheap variant, not per-chunk LLM contextualization (§3).

### 4.5 Retrieval

```
query
 → language detect (lingua)
 → deterministic acronym/synonym lexicon mined at ingest
 → embed with the model's asymmetric QUERY prefix        [today: no prefix, queries and
                                                          documents embedded identically]
 ├─ dense : embeddings JOIN chunks
 │          WHERE (all_access OR c.group_ids && $gids)   [GIN &&, replaces correlated EXISTS]
 │          ORDER BY vec <=> $q LIMIT 150
 │          SET LOCAL hnsw.ef_search=200,
 │                    hnsw.iterative_scan='relaxed_order'   [CONDITIONAL — see Phase 2]
 └─ lexical: stored tsv, per-document regconfig
             (russian | english | simple+pg_trgm+transliteration for Uzbek)
             OR-ed tsquery + rank cutoff                 [NOT plainto_tsquery, and NOT
                                                          websearch_to_tsquery, which still
                                                          ANDs unquoted terms]
 → fuse: min-max-normalized convex combination, single tuned weight,
         plus a deterministic shift toward lexical for quoted phrases, IDs, codes, rare OOV tokens
 → rerank 100 candidates: bge-reranker-v2-m3 on TEI/vLLM. Failure is LOUD.
 → cap 3-per-document  [AFTER reranking, not before]
 → parent-section expansion via blocks.parent_id, ONE batched query
 → answer
```

Every outbound HTTP call releases the pooled connection first, enforced by a test.

Model choices and their evidence:

- **Reranker — `bge-reranker-v2-m3` (Apache-2.0, ~1.2–2.5 GB VRAM).** MIRACL 69.32, beating
  jina-reranker-v3's 66.50 *in jina's own comparison table*: English BEIR leadership does not
  transfer to multilingual, and this corpus is Russian-first. `Qwen3-Reranker-0.6B` is the alternate.
  Rejected: Cohere Rerank (API-only), jina-v3/ctxl/zerank (non-commercial), Qwen3-Reranker-4B/8B
  (> 1 s per query for 100 candidates on an H100 — teachers for offline distillation, not online).
- **Rerank depth 100, not 20.** Elastic measured rerankers reaching ~90% of maximum gain at ~100
  pairs — but also found ~20% of corpora *unimodal* in depth, where deeper actively hurts. Measure
  depth on our corpus; do not assume 100.
- **Fusion — convex combination, not RRF.** Bruch et al. (TOIS 2023) show convex combination beats
  RRF in-domain and out-of-domain and that tuned RRF generalizes poorly; OpenSearch measured RRF at
  3.86% lower average nDCG@10 across six BEIR sets. RRF's rank-only nature is worst in exactly our
  situation.
- **Embedder — decided by bake-off, not by leaderboard.** MMTEB rank *inverts* for low-resource
  languages: Qwen3-Embedding-0.6B leads its size class on MMTEB (64.34) yet scores **6.64** on
  XTREME-UP, where EmbeddingGemma scores 47.72 and BGE-M3 26.91. **No public Uzbek retrieval
  benchmark exists at all.** Candidates: BGE-M3 (MIT), Qwen3-Embedding-0.6B (Apache-2.0),
  multilingual-e5-large-instruct (MIT), EmbeddingGemma-300m (Gemma Terms — needs legal sign-off
  before a bank contract). Two things must be implemented *before* the bake-off or every candidate is
  measured in its degraded configuration: per-model `format_query()`/`format_document()` prefixes,
  and stopping the unconditional `dimensions` parameter.

### 4.6 Answer, citations, audit

- Markers resolve to **blocks**. A sentence with no resolvable marker is dropped and the answer
  flagged. A figure not present in any retrieved block triggers refusal. Refusal becomes a structured
  field, not string equality against a sentinel (`answer.py:109`).
- Citations store a **frozen locator snapshot** + `quoted_text` + `parser_version`, so they survive
  re-ingest and cannot rot invisibly when a parser version changes.
- Low-`confidence` blocks render with a visible uncertainty marker and are excluded from attributed
  quotes.
- The source viewer dispatches on locator shape: charspan highlight, sheet grid with the A1 range
  outlined and header path shown, slide with the shape outlined. (bbox overlay and audio player are
  the deferred phases.)
- `query_log` becomes append-only and answer-reconstructing: plan, per-stage latency, per-arm candidate
  counts, `degraded[]`, answer text, context hash, model + version, and **the caller's resolved group
  set at query time**. Retention floor 6 months, configurable up (EU AI Act Art. 12 traceability /
  Art. 19 log retention enforceable from 2026-08-02).
- Groundedness: **HHEM-2.1-Open** (Apache-2.0, 0.1B on flan-t5-base, < 600 MB, CPU-only) scored per
  `(answer sentence, cited block)`, persisted as `citations.verifier_score`, **shown as a support
  indicator on English answers only, and reported-not-gating on Russian and Uzbek** until calibrated
  against human labels. Its Cyrillic performance is unpublished and a flan-t5-base backbone will
  likely be near-noise there; gating on it would silently drop correct Russian sentences while the
  same biased instrument reports the Russian slice as degraded in CI. **Instrument and gate must not
  share a failure mode.**

---

## 5. Evaluation — the harness that gates everything

This is Phase 1 and it is non-negotiable. There has never been CI on this repo.

- **Golden set: 120 questions from the pilot's own corpus** — 60 RU / 40 UZ / 20 EN, weighted to the
  pilot's actual language mix — with **chunk-level gold labels**, 20 unanswerable questions across
  UAEval4RAG's categories, and 15 permission-negative questions (a user who must *not* see the answer).
  Three adversarial filters before any human review: drop what a no-context baseline answers; drop
  answers appearing verbatim in ≥ 3 chunks; per-hop ablation for multi-hop questions.
- **Metrics** via `ranx` (MIT): recall@8, nDCG@8, doc-recall@8, MRR — sliced **by language and by
  question type**, with cluster-robust standard errors clustered by source document (with several
  questions per document, naive SEs can be 3× too small, so real regressions look like noise).
- **Label-free probe:** ANN-vs-exact recall — brute force with `enable_indexscan=off`, sweeping
  `ef_search {40,100,200,400}` × `iterative_scan {off, relaxed_order}` × synthesized ACL selectivity
  `{100,30,10,2,1,0.5}%`. Run **before** changing any GUC so the baseline is recoverable.
- **CI:** the first `.github/workflows/eval.yml`. Paired-delta gating against the base commit (free
  variance reduction; absolute thresholds on 120 questions produce constant false alarms), an `EXPLAIN`
  plan assertion so an index silently stops being used loudly instead, a hard fail on **any**
  permission leak, and an egress-blocked run of the ingest and ask paths.
- **Rejected as the gate:** RAGAS default LLM-judged metrics (Pearson 41.07 with human correctness vs
  RAGChecker's 61.93; an independent 2026 study calls its faithfulness "limited reliability"); Arize
  Phoenix (Elastic License 2.0); promptfoo as load-bearing (now part of OpenAI — a poor dependency for
  a sovereignty product).
- **Coverage is a first-class metric, not an accuracy metric:** bytes ingested / bytes present,
  documents producing zero chunks, DOCX tables extracted vs present. For §1.2 defects 7–8 the relevant
  number is *0 → retrievable*, and no nDCG delta describes it.

---

## 6. Phases

Each phase leaves the product working and shippable. **This spec locks the direction, not the task
list** — the work is too large for one implementation plan, so each phase gets its own plan under
`docs/superpowers/plans/`, written when that phase starts. Planning begins with Phase 1.

### Phase 1 — Measure, and stop the bleeding (3w)

Zero architectural change. Buys zero accuracy on purpose.

- **Instrument:** `degraded text[]`, per-stage latency, per-arm candidate counts, `rerank_applied`,
  lexical-arm row count — into `query_log` and the ask response. Make every silent failure loud: the
  bare `except: pass` in `rerank.py`, the `CONTEXTUAL_MODE=llm` no-op, zero-chunk documents marked
  `indexed`, out-of-range `[n]` markers, uncited answers.
- **Classify question types** (lookup / comparison / aggregate / enumerate) so D3's go/no-go has data.
- **Probe:** the ANN-vs-exact sweep of §5.
- **Stop the bleeding:** citation FKs → `ON DELETE SET NULL`; honour `row['index']` in `embed.py` and
  assert `len(vectors) == len(chunks)`; batch embeddings at 32; release the pooled connection before
  every outbound HTTP call, enforced by a test; add the missing indexes; replace Atlas's
  load-every-embedding-into-Python with `AVG(embedding) … GROUP BY`; check upload size before
  `req.formData()`.
- **Eval:** the golden set, `ranx` metrics, `.github/workflows/eval.yml`.

**Outcome:** an attribution table apportioning the accuracy complaint across the eleven candidate
causes; recall@8 / nDCG@8 / doc-recall@8 per language with CIs; ANN-recall plotted against selectivity;
a green CI that fails on a paired regression. From here every claim in this spec is falsifiable.

### Phase 2 — Repair retrieval in place + embedder bake-off (2.5w)

No schema change, no new service.

- Lexical: per-document `lang` + `ts_config`, trigger-populated `tsv`, partial GIN per config, OR-ed
  tsquery with a rank cutoff, `ts_rank_cd` normalization flag `32|1`.
- `hnsw.ef_search` / `iterative_scan` / `max_scan_tuples` per retrieval transaction — **conditional on
  Phase 1's probe. If ANN-recall came back at 0.97 at realistic selectivity, skip this and say so out
  loud.**
- Deploy `bge-reranker-v2-m3`; fix the Cohere-vs-TEI payload mismatch, the greedy `\[.*\]` regex and
  the unbounded truncation. Candidate pools 40 → 150, rerank depth 20 → 100.
- Move `cap_by_document` after reranking. Replace equal-weight RRF with normalized convex combination.
- Batch `_expand_neighbors` into one `(document_id, ordinal) IN (…)` query; de-duplicate the overlap.
- Test the accidental Matryoshka truncation: re-embed the corpus at native dims vs `dimensions=1024`.
- **Embedder bake-off, measurement only** (production cutover in Phase 3, once `embeddings` makes it
  reversible): implement asymmetric query/document prefixes and stop the unconditional `dimensions`
  parameter *first*, measure real RU/UZ tokenized chunk lengths (a ten-minute experiment that decides
  whether 512-token models are viable at all), then score all four candidates on the golden set.
- Flip the `MODELS_BASE_URL` default to fail-closed: today it defaults to `https://api.openai.com/v1`,
  so a missing env var silently exfiltrates document text to OpenAI — which contradicts the product.

**Outcome:** paired delta on the golden set, sliced by language and question type, with per-change
attribution (each lands as its own PR through the CI gate). Expect the largest single movement on the
Russian slice. Plus a per-language embedder ranking on our own corpus — the only Uzbek retrieval data
that exists anywhere, and therefore also a sales artifact.

### Phase 3 — Block model, durable queue, embedder cutover (5w)

- Create `document_versions`, `blocks`, `chunk_blocks`, `embeddings`, `ingest_jobs`.
- Backfill every existing chunk as a `kind='text'` block carrying its current
  `(page, char_start, char_end)` under a v1 version.
- `citations` gains `block_id` + frozen locator + `quoted_text` + `parser_version`.
- Denormalized `group_ids uuid[]` + trigger; switch the ACL predicate to GIN `&&`.
- Cast embeddings to `halfvec(1024)` — **budget a maintenance window**: a full table rewrite plus HNSW
  rebuild under `ACCESS EXCLUSIVE`, not a free cast. (`halfvec` buys memory and build time, not QPS —
  measured 0.97–1.04×.)
- Stand up `worker` with the Postgres queue.
- Embedder cutover: dual-column shadow migration, resumable backfill, a startup assertion that the
  configured model matches what is actually in the database, cut over only after the new index passes,
  drop the old column last. (Re-embedding 1M chunks is ~2–3 A100-hours — the model is the cheap
  reversible decision; the eval set is the durable asset.)
- Explicit expand-migrate-contract protocol across the web(Drizzle) / engine(Python) boundary with a
  documented rollback. **No partitioning. No PG18.**

**Outcome:** a reconciliation report re-resolving 100% of historical citations before and after
backfill with byte-identical quoted text and zero mismatches; golden-set metrics at parity (paired CI
includes zero); a container restart mid-ingest loses no work.

### Phase 4 — Any format, CPU tier (5w)

DOCX tables/headers/footnotes, XLSX, PPTX, HTML, CSV, EML. No GPU, no OCR, no new model.

Structure-aware chunking on the block tree; Summary-Augmented Chunking; sheet-grid and slide renderers
in the source viewer; raise the 25 MB upload cap; content sniffing and content-hash dedupe.

**Outcome:** corpus coverage (bytes ingested / bytes present; documents producing zero chunks; DOCX
tables extracted vs present) plus format-sliced recall. The number that matters here is
*0 → retrievable*, not nDCG.

### Phase 5 — Verification and audit surface (2w)

HHEM-2.1-Open per (sentence, cited block); the grounding contract enforced in code; append-only,
answer-reconstructing `query_log`.

**Outcome:** citation recall ≥ 0.85 and precision ≥ 0.75 on the English slice using ALCE's definitions
with HHEM substituted for TRUE (ALCE's best published system reached 84.8/81.6 on ASQA); a demonstrated
replay of any historical answer from the log alone, after the underlying document has been revised.

**Core total: ~17.5 engineer-weeks.**

### Deferred (post-pilot, in this order)

- **D1 — Scanned pages, images, bbox citations (4w).** Build a 150–300-page parser golden set of real
  RU/UZ documents *first*, scored with TEDS for tables and a reading-order metric, with an explicit
  go/no-go if PaddleOCR-VL shows its documented character-repetition failure mode on Cyrillic.
  **Rasterize on demand** (pypdfium2, tens of ms) — persisting derived page images costs ~120 GB per
  million pages and adds a backup-consistency surface. Requires GPU compute capability ≥ 8.0.
- **D2 — Audio (5w).** The moat. Language-routed ASR + pyannote diarization → `transcript_turn` blocks
  → click-to-play citations with karaoke word highlighting. Presidio (MIT) PII redaction over
  transcript and audio in one pass. **Week one is reproducing the model's Uzbek WER on five hours of
  our own audio** before committing the rest (§7.3).
- **D3 — Aggregation / typed-fact lane (5w), CONDITIONAL** on Phase 1's instrumentation showing
  aggregate/count/list questions exceed ~15% of real traffic **and** a named design partner for schema
  curation. Curated per-class JSON schemas into typed Postgres `fact_*` tables — **not DuckDB**
  (`read_csv('/etc/passwd')`, `COPY … TO`, `INSTALL`/`httpfs` are all reachable and raw document text
  already reaches prompts; and a per-workspace file forks the single access predicate). The measured
  gap is real (0.352 → 0.845 answer recall) but is measured on pre-selected aggregative questions, so
  the marginal product effect is *(aggregate share) × delta* — which is exactly why it is gated.

---

## 7. Honest uncertainty

1. **The literature contradicts itself, and only our corpus settles it.** Vectara/NAACL-2025 measured
   the embedding model dominating the chunker ~4× (+7.44% avg F1, p = 1.59e-5, vs < 2 F1@5 for chunker
   choice); a chemistry-domain study reports a tenfold IoU variation from segmentation alone. Both are
   true; the metric decides which. This is why Phase 1 precedes everything.
2. **Phase 2's `ef_search` fix could be everything or nothing.** AWS measured category-filtered recall
   going 10% → 100% on 10M vectors. But the complaint was formed on ~150 demo documents *as owner*,
   where `_perm_sql()` short-circuits to `TRUE` — at that scale and role the fix is plausibly inert.
   The probe costs an afternoon and settles it. Treating it as the headline before measuring is how
   plans end up 30 weeks deep behind an untested hypothesis.
3. **The GigaAM Uzbek WER (7.3% vs Whisper's 105.4%) is unverified.** It comes from arXiv 2607.10371,
   which postdates the researching model's knowledge cutoff and could not be independently confirmed.
   It carries the entire audio differentiation. Reproduce it on five hours of our own audio before
   committing D2. Also: verify the *weights* license separately from the MIT code; check which script
   (Latin or Cyrillic) it emits for Uzbek, because a script mismatch between transcript and query would
   silently destroy retrieval; and note that GigaAM is authored by Sber, a sanctioned Russian state
   bank, which is a procurement conversation for any EU/UK deal.
4. **Reranker gains may not transfer.** T2-RAGBench measured hybrid RRF 0.695 → +cross-encoder 0.816
   Recall@5, but it indexed whole documents with no chunking, used a proprietary API reranker, and is
   English SEC filings. Directionally solid; magnitude to be measured here.
5. **Effort estimates.** All six adversarial critiques flagged the original estimates as 2–3×
   optimistic. The 17.5 weeks above is already scoped down (no partitioning, no PG18, no visual index,
   no fact tables, 120 questions not 300, OCR and audio deferred). For a solo founder who also sells
   and supports, treat it as 5–6 months calendar, or ~3 with one backend engineer.

---

## 8. Open decisions

| Decision | Recommendation |
|---|---|
| **Solo, or hire one backend/Postgres engineer?** | Hire. The work that blows up — raw-SQL migrations across the web/engine boundary, the durable queue, the per-modality viewers — is precisely the work that does not use a speech/RL/LLM-reliability edge. If cash forbids it, cut D3 permanently and treat D2 as the point where you stop and sell. |
| **Real BM25 in Postgres, or a tuned tsvector?** | Ship the tuned tsvector in Phase 2 — independently valuable, blocks nothing. In parallel, read `pg_textsearch`'s actual LICENSE file; if permissive, schedule its PG17 requirement into the same maintenance window as Phase 3's re-embed so the customer takes one outage, not two. Do **not** take ParadeDB `pg_search`: AGPL-3.0 inside a proprietary appliance shipped to a bank is a procurement conversation you lose. |
| **Publish the eval harness and our numbers?** | Publish, after the format phases. No competitor publishes a reproducible number — Glean publishes preference ratios with no methodology, Onyx's benchmark is "to release soon", and Hebbia's widely-quoted 92% could not be located on any Hebbia-controlled page. Being the only vendor with a runnable harness and a real number on Uzbek bank documents is a procurement advantage an ML-researcher founder is unusually well placed to earn. |
| **Pilot-site hardware.** | Assumed: a GPU already present for the chat model, with ~5 GB free for embedder + reranker. If CPU-only, the reranker choice changes and must be re-measured. Publish the hardware minimum (GPU class, 64–128 GB host RAM, ~150–250 GB usable disk plus WAL and backups) on one page; never let a customer discover it after signing. Note an uncosted ops reality: an air-gapped bundle carrying baked-in model weights is plausibly 40–80 GB per install *and per upgrade* — physical-media logistics, not a `docker pull`. |

---

## 9. Success criteria

1. `uv run pytest` and a green CI verify retrieval behaviour — including the permission-filter test —
   without a developer remembering to set `DATABASE_URL`.
2. A published attribution table naming which of the eleven §1.2 defects actually caused the observed
   inaccuracy, with per-language paired deltas for each fix.
3. Re-uploading a revised document leaves every historical citation resolvable, with byte-identical
   quoted text.
4. A DOCX whose content is mostly tables, an XLSX, and a PPTX each produce retrievable, correctly
   located blocks, and a citation from each renders in its own viewer.
5. A query in Russian retrieves a Russian document matching on an inflected form.
6. Turning each new stage off by config reproduces the previous behaviour — safe rollback at every step.
7. Zero outbound network calls on the ingest and ask paths, proven by an egress-blocked CI run.

## 10. Non-goals

Visual/late-interaction retrieval · a second datastore · GraphRAG · RAPTOR · agent loops · semantic
chunking · HyDE · table partitioning · PG18 · training our own parser or embedding model · any hosted
API on the ingest or answer path · connector breadth.

---

## 11. Evidence index

| Topic | Source |
|---|---|
| pgvector filtered-scan recall, iterative scan | https://github.com/pgvector/pgvector · https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/ |
| ViDoRe v3 text-only > visual | https://arxiv.org/html/2604.01733v1 |
| Semantic chunking does not beat fixed-size | https://arxiv.org/abs/2410.13070 |
| Contextual retrieval, independent reproduction | https://arxiv.org/pdf/2509.20354 |
| Fusion: convex combination vs RRF | https://arxiv.org/abs/2210.11934 |
| Agentic retrieval ablations | https://arxiv.org/html/2606.21553 |
| Docling | https://github.com/docling-project/docling |
| OCR engine comparison | https://towardsdatascience.com/i-spent-may-evaluating-different-engines-for-ocr/ · https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6 |
| ASR/Uzbek claim (**unverified**) | https://arxiv.org/html/2607.10371v1 |
| HHEM-2.1-Open | https://huggingface.co/vectara/hallucination_evaluation_model |
| ALCE citation metrics | https://ar5iv.labs.arxiv.org/html/2305.14627 |
| Onyx migrating off Vespa | https://docs.onyx.app/admins/advanced_configs/opensearch_document_index_migration |
| Postgres BM25 options | https://www.pedroalonso.net/blog/postgres-bm25-search/ |
| Enterprise ACL denormalization patterns | https://arxiv.org/pdf/2602.03992 · https://arxiv.org/html/2601.08620v1 |
