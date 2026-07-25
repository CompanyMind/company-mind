import os
import uuid

import httpx
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_ingest_and_ask_make_no_outbound_calls(monkeypatch):
    """With no MODELS_BASE_URL configured, the deterministic fake providers must
    carry the entire pipeline. Any outbound HTTP from a customer's air-gapped
    deployment kills the deal and cannot be walked back."""

    def forbidden(*args, **kwargs):
        raise AssertionError(f"outbound HTTP attempted: {args[:1]}")

    monkeypatch.setattr(httpx, "post", forbidden)
    monkeypatch.setattr(httpx, "get", forbidden)

    from app.ask.retrieve import retrieve
    from evals.run import drop_fixture_workspace, seed_fixture_workspace

    ws = seed_fixture_workspace()
    try:
        hits, dbg = retrieve(ws, "How long are records retained?", all_access=True)
        assert dbg.dense_n >= 0  # completed without touching the network
    finally:
        drop_fixture_workspace(ws)
