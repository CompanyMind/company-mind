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
