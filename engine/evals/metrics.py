"""Retrieval metrics and a cluster-robust paired bootstrap.

Clustering matters: with several questions drawn from the same source document,
naive standard errors can be ~3x too small, so a real regression looks like noise
and ships.

LIMITATION — quote_recall does not stitch chunks. `score_question` checks each gold
quote against each retrieved chunk's text independently; it never concatenates
adjacent chunks. A verbatim quote that straddles a chunk boundary is invisible to
it even though the document was clearly retrieved (doc_recall/mrr/ndcg all
succeed). This is deliberate — cross-chunk stitching would introduce its own
matching errors — so gold quotes must be authored short enough to sit inside a
single chunk (see `GoldenQuestion.gold_quotes` in goldenset.py).
"""

import math
import random
import re

from ranx import Qrels, Run, evaluate

from .goldenset import GoldenQuestion


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def score_question(retrieved: list[dict], q: GoldenQuestion, k: int) -> dict[str, float]:
    """`retrieved` is an ordered list of {"filename": str, "text": str}, best first.

    quote_recall matches each gold quote against one chunk's text at a time — it
    does not stitch adjacent chunks. A gold quote that spans a chunk boundary will
    never be found, regardless of retrieval quality; see the module docstring.
    """
    top = retrieved[:k]
    if not q.answerable:
        # An unanswerable question has no gold, so every retrieval metric is
        # meaningless for it — and averaging its structural zero into the means
        # would permanently depress them in proportion to how many unanswerable
        # questions the set contains. run_eval() MUST exclude these from the means
        # and track them separately (see `unanswerable` in its report).
        return {"doc_recall": 0.0, "quote_recall": 0.0, "mrr": 0.0, "ndcg": 0.0}

    gold_files = {_norm(f) for f in q.gold_filenames}
    gold_quotes = [_norm(t) for t in q.gold_quotes]

    hit_ranks = [
        i for i, r in enumerate(top, start=1) if _norm(r.get("filename", "")) in gold_files
    ]
    doc_recall = 1.0 if hit_ranks else 0.0
    mrr = 1.0 / hit_ranks[0] if hit_ranks else 0.0

    texts = [_norm(r.get("text", "")) for r in top]
    found = sum(1 for quote in gold_quotes if any(quote in t for t in texts))
    quote_recall = found / len(gold_quotes) if gold_quotes else 0.0

    # nDCG over the document-level relevance signal, via ranx so the discounting
    # is a well-tested implementation rather than ours. ranx's Run takes one score
    # per (query, doc) pair, but a gold filename can appear at several ranks — the
    # NORMAL case once retrieval is chunk-level, not an edge case — so duplicates
    # must be collapsed before building the Run. Keep the BEST (highest) score per
    # filename: a plain `{_norm(...): score for i, r in enumerate(top)}`
    # comprehension would instead keep the LAST-seen occurrence, which is always
    # the worst-ranked one (scores decrease with rank), silently punishing a
    # question for having MORE correct evidence retrieved. Do not "simplify" this
    # back into a comprehension.
    run_scores: dict[str, float] = {}
    for i, r in enumerate(top):
        fname = _norm(r.get("filename", ""))
        score = float(len(top) - i)
        if score > run_scores.get(fname, float("-inf")):
            run_scores[fname] = score
    qrels = Qrels({q.id: {f: 1 for f in sorted(gold_files)}})
    run = Run({q.id: run_scores})
    # Pass the metric as a STRING, not a list: ranx returns a bare float for a
    # single metric name and a dict when given a list.
    ndcg = float(evaluate(qrels, run, f"ndcg@{k}")) if top else 0.0

    return {"doc_recall": doc_recall, "quote_recall": quote_recall, "mrr": mrr, "ndcg": ndcg}


def paired_bootstrap(
    base: dict[str, dict],
    new: dict[str, dict],
    metric: str,
    cluster_by: dict[str, str],
    iters: int = 2000,
    seed: int = 7,
) -> tuple[float, float, float]:
    """Mean paired delta (new - base) with a 95% CI, resampling CLUSTERS (source
    documents) rather than questions. Returns (mean, ci_low, ci_high)."""
    shared = [qid for qid in base if qid in new]
    if not shared:
        return (0.0, 0.0, 0.0)

    by_cluster: dict[str, list[float]] = {}
    for qid in shared:
        delta = float(new[qid].get(metric, 0.0)) - float(base[qid].get(metric, 0.0))
        by_cluster.setdefault(cluster_by.get(qid, qid), []).append(delta)

    clusters = sorted(by_cluster)
    all_deltas = [d for c in clusters for d in by_cluster[c]]
    mean = sum(all_deltas) / len(all_deltas)

    rng = random.Random(seed)
    means: list[float] = []
    for _ in range(iters):
        picked = [by_cluster[rng.choice(clusters)] for _ in clusters]
        flat = [d for group in picked for d in group]
        if flat:
            means.append(sum(flat) / len(flat))
    means.sort()
    lo = means[max(0, math.floor(0.025 * len(means)))]
    hi = means[min(len(means) - 1, math.ceil(0.975 * len(means)) - 1)]
    return (mean, lo, hi)
