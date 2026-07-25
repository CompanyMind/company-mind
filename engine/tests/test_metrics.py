from evals.goldenset import GoldenQuestion
from evals.metrics import paired_bootstrap, score_question


def _q(**kw):
    base = dict(
        id="q1", question="x", lang="en", qtype="lookup", answerable=True,
        gold_filenames=["a.txt"], gold_quotes=["seven years"], group_names=[],
        all_access=True, must_not_retrieve=[],
    )
    base.update(kw)
    return GoldenQuestion(**base)


def test_perfect_retrieval_scores_one():
    retrieved = [{"filename": "a.txt", "text": "retention is seven years"}]
    s = score_question(retrieved, _q(), k=8)
    assert s["doc_recall"] == 1.0
    assert s["quote_recall"] == 1.0
    assert s["mrr"] == 1.0


def test_wrong_document_scores_zero():
    retrieved = [{"filename": "b.txt", "text": "unrelated"}]
    s = score_question(retrieved, _q(), k=8)
    assert s["doc_recall"] == 0.0
    assert s["quote_recall"] == 0.0
    assert s["mrr"] == 0.0


def test_rank_two_hit_gives_half_mrr():
    retrieved = [
        {"filename": "b.txt", "text": "unrelated"},
        {"filename": "a.txt", "text": "retention is seven years"},
    ]
    assert score_question(retrieved, _q(), k=8)["mrr"] == 0.5


def test_quote_match_ignores_case_and_whitespace():
    retrieved = [{"filename": "a.txt", "text": "Retention  is\nSEVEN   YEARS."}]
    assert score_question(retrieved, _q(), k=8)["quote_recall"] == 1.0


def test_ndcg_is_one_when_the_gold_document_is_the_top_hit():
    retrieved = [{"filename": "a.txt", "text": "retention is seven years"}]
    assert score_question(retrieved, _q(), k=8)["ndcg"] == 1.0


def test_ndcg_is_strictly_lower_when_the_only_hit_is_at_rank_three():
    retrieved = [
        {"filename": "b.txt", "text": "unrelated"},
        {"filename": "c.txt", "text": "also unrelated"},
        {"filename": "a.txt", "text": "retention is seven years"},
    ]
    rank_one = score_question(
        [{"filename": "a.txt", "text": "retention is seven years"}], _q(), k=8
    )["ndcg"]
    rank_three = score_question(retrieved, _q(), k=8)["ndcg"]
    assert rank_three < rank_one


def test_a_second_hit_on_the_same_gold_document_never_lowers_ndcg():
    # Regression test: ranx's Run takes one score per (query, doc), so a gold
    # filename that shows up at several ranks (the normal case once retrieval is
    # chunk-level, not an edge case) must be collapsed to its BEST rank before
    # building the Run. A naive dict comprehension keyed by filename keeps the
    # LAST-seen occurrence instead, which is the worst-ranked one, so retrieving an
    # extra correct chunk of the same document — strictly more supporting evidence,
    # with the best rank unchanged — must never lower nDCG below the rank-1-only
    # score.
    rank_one_only = score_question(
        [{"filename": "a.txt", "text": "retention is seven years"}], _q(), k=8
    )["ndcg"]
    rank_one_and_three = score_question(
        [
            {"filename": "a.txt", "text": "retention is seven years"},
            {"filename": "b.txt", "text": "unrelated"},
            {"filename": "a.txt", "text": "seven years, restated elsewhere"},
        ],
        _q(),
        k=8,
    )["ndcg"]
    assert rank_one_and_three >= rank_one_only


def test_quote_spanning_two_retrieved_chunks_is_a_known_limitation():
    # quote_recall checks each gold quote against each retrieved chunk's text
    # independently — it does not stitch adjacent chunks together (see the
    # module docstring and GoldenQuestion.gold_quotes for why: curators must keep
    # gold quotes inside a single chunk). This pins the current, deliberate
    # behaviour: a quote that straddles a chunk boundary scores 0 even though the
    # document itself was clearly retrieved (doc_recall/mrr/ndcg all succeed).
    q = _q(gold_quotes=["retention is seven years"])
    retrieved = [
        {"filename": "a.txt", "text": "the policy states that retention is"},
        {"filename": "a.txt", "text": "seven years for all financial records"},
    ]
    s = score_question(retrieved, q, k=8)
    assert s["doc_recall"] == 1.0
    assert s["quote_recall"] == 0.0


def test_paired_bootstrap_detects_a_real_improvement():
    base = {f"q{i}": {"doc_recall": 0.0} for i in range(40)}
    new = {f"q{i}": {"doc_recall": 1.0} for i in range(40)}
    clusters = {f"q{i}": f"doc{i // 4}" for i in range(40)}
    mean, lo, hi = paired_bootstrap(base, new, "doc_recall", clusters)
    assert mean == 1.0
    assert lo > 0.0


def test_paired_bootstrap_reports_no_change_as_zero():
    base = {f"q{i}": {"doc_recall": 0.5} for i in range(40)}
    clusters = {f"q{i}": f"doc{i // 4}" for i in range(40)}
    mean, lo, hi = paired_bootstrap(base, dict(base), "doc_recall", clusters)
    assert mean == 0.0
    assert lo <= 0.0 <= hi


def test_paired_bootstrap_with_heterogeneous_clusters_exercises_real_resampling():
    # In the two tests above, every delta within every cluster is identical, so
    # every resample yields the same mean and the CI collapses to a point — an
    # implementation that skipped resampling entirely and returned (mean, mean,
    # mean) would pass both. Here only 2 of 10 clusters improve, so which clusters
    # land in a given resample actually changes its mean, and the CI should be a
    # genuine interval around the true pooled mean (0.2).
    base: dict[str, dict] = {}
    new: dict[str, dict] = {}
    clusters: dict[str, str] = {}
    improving = {"doc0", "doc1"}
    for c in range(10):
        cluster_id = f"doc{c}"
        for j in range(4):
            qid = f"q{c}_{j}"
            base[qid] = {"doc_recall": 0.0}
            new[qid] = {"doc_recall": 1.0 if cluster_id in improving else 0.0}
            clusters[qid] = cluster_id

    mean, lo, hi = paired_bootstrap(base, new, "doc_recall", clusters)
    assert mean == 0.2
    assert lo < hi  # a genuine interval, not a collapsed point
    assert lo <= mean <= hi

    # Deterministic given the same seed.
    again = paired_bootstrap(base, new, "doc_recall", clusters)
    assert again == (mean, lo, hi)

    # A different seed still lands in a sane range; the point estimate never
    # depends on the seed, only the resampled CI does.
    mean_s2, lo_s2, hi_s2 = paired_bootstrap(base, new, "doc_recall", clusters, seed=99)
    assert mean_s2 == mean
    assert 0.0 <= lo_s2 <= hi_s2 <= 1.0
