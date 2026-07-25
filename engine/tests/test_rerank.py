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


def test_llm_reranker_records_degradation_on_unparseable_response():
    """A reranker that silently returns fusion order is indistinguishable from one
    that never ran. Every fallback must leave a trace."""
    from app.ask.rerank import LLMReranker, RerankItem

    items = [RerankItem("a", "alpha"), RerankItem("b", "beta")]
    degraded: list[str] = []
    r = LLMReranker(call=lambda prompt: "I'm afraid I can't do that.")
    assert r.rerank("q", items, 2, degraded) == ["a", "b"]
    assert any(d.startswith("rerank_unparseable") for d in degraded), degraded


def test_llm_reranker_records_nothing_on_success():
    from app.ask.rerank import LLMReranker, RerankItem

    items = [RerankItem("a", "alpha"), RerankItem("b", "beta")]
    degraded: list[str] = []
    r = LLMReranker(call=lambda prompt: '[{"index": 2, "score": 9}, {"index": 1, "score": 3}]')
    assert r.rerank("q", items, 2, degraded) == ["b", "a"]
    assert degraded == []
