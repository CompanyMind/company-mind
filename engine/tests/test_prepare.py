import pytest

import app.ingest.prepare as prepare_mod
from app.ingest.prepare import prepare_document


def test_prepare_touches_no_database(monkeypatch):
    """The embedding call can take a minute. Holding one of the pool's ten
    connections across it starves every ask, Telegram poll and Atlas request."""

    def explode(*args, **kwargs):
        raise AssertionError("prepare_document must not open a database connection")

    monkeypatch.setattr(prepare_mod, "get_conn", explode, raising=False)
    # Also guard the module the pool actually lives in.
    import app.db

    monkeypatch.setattr(app.db, "get_conn", explode)

    out = prepare_document("notes.txt", "text/plain", b"alpha beta gamma", "header")
    assert out.parsed.text == "alpha beta gamma"
    assert len(out.chunks) == 1
    assert len(out.vectors) == len(out.chunks)
    assert out.embed_inputs[0].startswith("notes.txt")


def test_prepare_returns_empty_for_blank_document():
    out = prepare_document("blank.txt", "text/plain", b"", "header")
    assert out.chunks == []
    assert out.vectors == []
