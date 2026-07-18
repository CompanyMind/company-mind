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
