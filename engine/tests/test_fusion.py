from app.ask.fusion import rrf, cap_by_document


def test_rrf_consensus_beats_single_top():
    # 'b' is #2 in BOTH lists; 'a' is #1 in one list only and absent from the
    # other. Consensus (2 × 1/62) outweighs a single strong vote (1/61).
    fused = rrf([["a", "b"], ["c", "b"]], k=60)
    order = [cid for cid, _ in fused]
    assert order[0] == "b"


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
