# Retrieval accuracy — attribution

**Date:** 2026-07-25
**Status:** Partial. One cause confirmed; five require the pilot corpus to quantify.
**Inputs:** the Phase 1 instruments — `engine/evals/run.py` (eval harness),
`engine/evals/probe_ann.py` (ANN-vs-exact probe), and the `query_log` telemetry added in Task 9.
**Spec:** `docs/superpowers/specs/2026-07-25-retrieval-rearchitecture-design.md` §1.2 lists the
eleven candidate causes this document apportions.

## How to read this

Phase 1 built the instruments and fixed the defects that were destroying data. It did **not** set out
to improve accuracy — every change in it was either a measurement or a bug fix, and the design says
so explicitly. This document records what those instruments say so far.

Two categories of evidence appear below and must not be confused:

- **Measured** — observed on this machine against the committed synthetic fixture corpus with the
  deterministic fake providers. Good for confirming a *mechanism*; useless for estimating a *rate*,
  because the fixture is four documents and the fake embedder is not semantic.
- **Requires the pilot** — needs the real Russian/Uzbek corpus and self-hosted models. Commands are
  given in §5. Nobody should quote a number for these until that run happens.

Anything not in one of those two categories is not evidence.

## 1. The one cause confirmed today

**Defect #1 — `plainto_tsquery` ANDs every query term, and is used as a hard `WHERE` filter.**
`engine/app/ask/retrieve.py:50`.

Per-question lexical-arm row counts over the fixture golden set:

| Question | Lang | Lexical rows | Dense rows | Degradation flag |
|---|---|---|---|---|
| f1 — How long are customer transaction records retained? | en | **0** | 4 | `lexical_arm_empty` |
| f2 — What does CKPT_PREFETCH control? | en | 1 | 4 | — |
| f3 — Сколько лет хранятся записи о транзакциях клиентов? | ru | **0** | 4 | `lexical_arm_empty` |
| f4 — За сколько дней нужно уведомить о расторжении договора? | ru | **0** | 4 | `lexical_arm_empty` |
| f5 — Kim bir million so'mdan ortiq xarajatni tasdiqlashi kerak? | uz | **0** | 4 | `lexical_arm_empty` |
| f6 — How many documents mention retention? | en | **0** | 4 | `lexical_arm_empty` |
| f7 — What is our policy on Mars colony travel? | en | **0** | 4 | `lexical_arm_empty` |
| f8 — What is the Band 4 salary range? | en | **0** | 3 | `lexical_arm_empty` |

**Seven of eight questions retrieve nothing at all from the lexical arm.** The single exception, `f2`,
is a rare exact token (`CKPT_PREFETCH`) — precisely the query shape the lexical arm was added for, and
the only shape it currently serves.

This is not a Cyrillic problem and not a corpus-size artefact. It fires on plain English questions,
and the mechanism is corpus-independent: `plainto_tsquery` joins every lemma with `AND`, so a
ten-content-word question requires all ten lemmas inside one 300-word chunk. Equal-weight RRF then
fuses a populated dense list with an empty lexical list and silently produces dense-only results.

**Conclusion: "hybrid retrieval" has been dense-only for essentially every natural-language question
since migration `0006`.** The system was never doing what its design document said it was doing.

Russian and Uzbek carry a *second*, independent defect stacked on top — `to_tsvector('english', …)`
applies an English snowball stemmer to Cyrillic, where it is a no-op, so «договор» cannot match
«договора» in a six-case language. That one is invisible in the table above only because the AND
semantics already reduced the arm to zero rows before stemming could matter.

## 2. Attribution table

| # | Cause (spec §1.2) | Evidence | Share of the complaint | Fix phase | Confidence |
|---|---|---|---|---|---|
| 1 | `plainto_tsquery` ANDs all terms | **Measured**: 7/8 questions get 0 lexical rows, all languages | Large — the lexical half of hybrid is inert | Phase 2 | **High** |
| 2 | `to_tsvector('english')` over Cyrillic | Mechanism certain from code; masked by #1 today | Large on RU/UZ, zero on EN | Phase 2 | High (mechanism), unquantified (rate) |
| 3 | HNSW + selective ACL filter, `ef_search` unset | **Requires the pilot.** Probe built and self-tested; fixture corpus (4 docs) cannot exercise it | Unknown — plausibly zero at pilot scale, plausibly dominant at 10⁶ chunks | Phase 2, **gated on the probe** | Unknown by design |
| 4 | Reranker fails silently | Now instrumented (`reranker`, `rerank_applied`, `degraded[]`). Fixture runs use `FakeReranker`, so nothing to attribute yet | Unknown until a real reranker runs | Phase 2 | Unknown |
| 5 | `cap_by_document` before reranking | Code-confirmed; no measurement attempted | Unknown, structurally a recall ceiling | Phase 2 | Medium |
| 6 | Equal-weight RRF over a frequently-empty list | Follows directly from #1 — a rank-1 hit from a 1-row lexical list scores the same as the best dense hit | Compounds #1 | Phase 2 | High |
| 7 | `python-docx` drops every table/header/footnote | **Not measured.** The fixture corpus is `.txt` only; no DOCX path is exercised anywhere | Unknown, but coverage loss is silent and total for table-heavy documents | Phase 4 | High (mechanism) |
| 8 | `pypdf`, no OCR; scans index as empty | **Partially fixed**: zero-chunk documents now fail loudly instead of reading as `indexed` with `error=NULL` (Task 4). Detection, not extraction | Deferred — no scans in the pilot corpus | Deferred (D1) | High (mechanism) |
| 9 | `CONTEXTUAL_MODE=llm` silently a no-op | **Fixed** in Task 8 — now fails fast at startup naming the phase that implements it | Was a latent trap, not an active cause | Done | High |
| 10 | Accidental Matryoshka truncation (1536→1024) | **Requires the pilot.** Needs real embeddings to compare native vs truncated dims | Unknown | Phase 2 | Unknown |
| 11 | No evaluation, no CI | **Fixed.** CI exists; 122 tests run on every push; a permission leak or paired regression fails the build | Was the reason every other row was unanswerable | Done | — |

## 3. What Phase 2 should do, given the numbers

**Do the lexical repair first, and expect the largest single movement from it.** It is the only cause
confirmed by measurement, the mechanism is understood exactly, and it is cheap. Per-document `lang` +
`ts_config`, a trigger-populated `tsv` with per-config partial GIN indexes, and **OR-ed tsquery
semantics with a rank cutoff** — not `plainto_tsquery`, and not `websearch_to_tsquery` either, which
still ANDs unquoted terms.

**Do not touch `ef_search` until the probe has run on the pilot corpus.** The spec already flagged
this as "could be everything or nothing," and Phase 1 did not settle it: the fixture corpus is four
documents, and the founder's original complaint was formed as an *owner*, where `_perm_sql()`
short-circuits to `TRUE` and the filtered-ANN failure mode cannot occur at all. Running the probe
costs an afternoon and produces a definitive answer. If ANN recall comes back ≥0.97 at realistic
selectivity, skip that work and say so out loud.

**Treat the reranker change as unmeasured.** It is well-evidenced in the literature and almost
certainly worth doing, but this repo has no number for it yet, and the fixture runs use the identity
`FakeReranker`. Land it as its own PR through the CI gate so its paired delta is attributable.

## 4. What the first baseline actually says

```
doc_recall     1.0
quote_recall   1.0
ndcg           0.7384460930122322
mrr            0.6527777777777778
lexical_n      0.1667      <- 1 lexical row across 6 answerable questions
degraded_n     0.8333      <- 5 of 6 answerable questions carried a degradation flag
n_answerable   6
n_unanswerable 2
```

**These numbers are a determinism check, not a quality signal.** `doc_recall 1.0` on a four-document
corpus means the right document is hard to miss, not that retrieval is good. Their value is that two
consecutive runs produced byte-identical output, which is what makes the paired-delta CI gate
meaningful. `lexical_n` and `degraded_n` are the two rows that carry real information, and both say
the same thing as §1.

## 5. What still requires the pilot — exact commands

Run these against the pilot workspace with `MODELS_BASE_URL` pointing at the self-hosted endpoint.
The golden set and corpus paths must live **outside** this repo; `.gitignore` covers
`engine/evals/local/` and `*.local.jsonl` for that reason.

```bash
cd engine

# 1. Real accuracy numbers, sliced by language.
MODELS_BASE_URL=<self-hosted endpoint> DATABASE_URL=<pilot dsn> \
  uv run python -m evals.run --workspace <pilot-workspace-uuid> \
  --golden /path/outside/repo/pilot-golden.jsonl

# 2. The ef_search decision. Run BEFORE changing any GUC so the baseline is recoverable.
DATABASE_URL=<pilot dsn> \
  uv run python -m evals.probe_ann --workspace <pilot-workspace-uuid> \
  --queries /path/outside/repo/pilot-queries.txt --out /tmp/probe_ann.json
```

Read the probe's table with the `n_gold` column beside the recall column: a row with `n_gold = 0`
reports `recall = n/a`, not a fabricated 1.0. That distinction exists because the first version of the
probe reported a perfect score for rows where nothing had been measured.

Then the question-type shares, which gate whether the structured-aggregation lane (spec D3) gets built
at all — it needs the aggregate/enumerate share to exceed ~15% of real traffic:

```sql
SELECT question_type,
       count(*)                                                          AS n,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1)                 AS pct,
       avg((candidate_counts->>'lexical')::int)                           AS avg_lexical_rows,
       count(*) FILTER (WHERE 'lexical_arm_empty' = ANY(degraded))        AS lexical_dead,
       count(*) FILTER (WHERE NOT rerank_applied)                         AS rerank_skipped,
       count(*) FILTER (WHERE 'answer_uncited' = ANY(degraded))           AS uncited
FROM query_log
WHERE workspace_id = '<pilot-workspace-uuid>'
  AND created_at > now() - interval '7 days'
GROUP BY question_type
ORDER BY n DESC;
```

**Caveat on that query, recorded during Phase 1:** the Uzbek keyword patterns in
`engine/app/ask/qtype.py` use a straight ASCII apostrophe (`ro'yxat`, `o'rtacha`), while real Uzbek
Latin commonly uses U+02BB/U+02BC. If the pilot's text uses the modifier-letter form, those keywords
never match and the Uzbek aggregate/enumerate share is **systematically undercounted** — which would
bias the D3 build/skip decision toward "skip." Check the corpus's actual apostrophe codepoint before
trusting the shares. Also note `timings_ms` does not always contain a `rerank` key (the empty-fused
early return skips that stage), so use `->>'rerank'` and expect NULL rather than assuming presence.

## 6. Honest limits of this document

- Nothing here was measured against real customer documents or real models. Every rate is provisional.
- The fixture corpus contains no DOCX, no PDF, no spreadsheet and no scan, so causes #7 and #8 are
  attributed from code reading alone.
- The eval harness's own CI workflow has not yet been exercised by a real GitHub Actions run; it was
  verified locally and structurally mirrors the working `ci.yml`.
- `doc_recall` is a binary any-hit indicator per question, not a fraction, so a comparison question
  that needs two documents scores 1.0 on retrieving either. It becomes a true recall only when
  averaged across the set.
