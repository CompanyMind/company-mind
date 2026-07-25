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
