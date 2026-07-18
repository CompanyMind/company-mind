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


def test_stopword_only_returns_empty_keywords():
    texts = ["the of and is", "the of and is"]
    labels = np.array([0, 1])
    kw = keywords_per_cluster(texts, labels)
    assert kw == {0: [], 1: []}
