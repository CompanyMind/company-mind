from app.ask.retrieve import Retrieved
from app.ask.answer import answer_question, REFUSAL


def _r(i, text):
    return Retrieved(f"chunk-{i}", f"doc-{i}", f"f{i}.txt", 1, 0, len(text), text, 0.9)


def test_empty_context_refuses():
    out = answer_question("anything?", [])
    assert out.insufficient is True
    assert out.answer == REFUSAL
    assert out.citations == []


def test_answer_cites_resolvable_markers_only():
    out = answer_question("what is retained?", [_r(1, "Backups are retained 30 days.")])
    assert out.insufficient is False
    assert any(c.marker == 1 and c.chunk_id == "chunk-1" for c in out.citations)
    assert all(1 <= c.marker <= 1 for c in out.citations)


def test_citation_snippet_uses_matched_text_not_expanded_context():
    r = Retrieved("chunk-1", "doc-1", "f.txt", 1, 0, 5, "MATCH", 0.9, context="NEIGHBOR MATCH NEIGHBOR")
    out = answer_question("what?", [r])
    assert out.citations[0].snippet.startswith("MATCH")


def test_out_of_range_marker_is_recorded_not_silently_dropped():
    from app.ask.answer import resolve_citations
    from app.ask.retrieve import Retrieved

    retrieved = [Retrieved("c1", "d1", "f.txt", 1, 0, 5, "alpha", 1.0, "alpha")]
    # The model cited [3] with only one source in context. Today that marker is
    # dropped in silence and the answer renders as if it were fully cited.
    citations, degraded = resolve_citations("Alpha holds [1] and also [3].", retrieved)
    assert [c.marker for c in citations] == [1]
    assert "citation_out_of_range:3" in degraded


def test_uncited_answer_is_flagged():
    from app.ask.answer import resolve_citations

    citations, degraded = resolve_citations("There is no marker here at all.", [])
    assert citations == []
    assert "answer_uncited" in degraded


def test_well_cited_answer_records_nothing():
    from app.ask.answer import resolve_citations
    from app.ask.retrieve import Retrieved

    retrieved = [Retrieved("c1", "d1", "f.txt", 1, 0, 5, "alpha", 1.0, "alpha")]
    citations, degraded = resolve_citations("Alpha holds [1].", retrieved)
    assert [c.marker for c in citations] == [1]
    assert degraded == []
