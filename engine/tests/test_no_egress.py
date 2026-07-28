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


def test_health_makes_no_outbound_call_on_the_hosted_default(monkeypatch):
    """/health is polled by the container healthcheck. It used to run
    `httpx.get(f"{models_base_url}/models")` unconditionally — so on the default
    configuration that was an unauthenticated request to api.openai.com every
    few seconds, forever, from the product that promises nothing leaves the
    customer's network.
    """
    from fastapi.testclient import TestClient

    import app.health as health
    from app.main import app as fastapi_app
    from app.settings import OPENAI_DEFAULT_BASE, settings

    def forbidden(*args, **kwargs):
        raise AssertionError(f"outbound HTTP attempted from /health: {args[:1]}")

    monkeypatch.setattr(health.httpx, "get", forbidden)
    monkeypatch.setattr(settings, "models_base_url", OPENAI_DEFAULT_BASE)
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "fake_models", False)

    body = TestClient(fastapi_app).get("/health").json()
    assert body["status"] == "ok"
    # Reported from configuration, not from a probe.
    assert body["models"] is True

    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "fake_models", True)
    assert TestClient(fastapi_app).get("/health").json()["models"] is None


def test_health_does_probe_a_self_hosted_endpoint(monkeypatch):
    """The on-prem case is the one where reachability is a real question, and
    the endpoint is inside the customer's own network — so it IS probed."""
    from fastapi.testclient import TestClient

    import app.health as health
    from app.main import app as fastapi_app
    from app.settings import settings

    called: list[str] = []

    class _R:
        status_code = 200

    def spy(url, **kwargs):
        called.append(url)
        return _R()

    monkeypatch.setattr(health.httpx, "get", spy)
    monkeypatch.setattr(settings, "models_base_url", "http://gpu-box.internal:8000/v1")
    monkeypatch.setattr(settings, "fake_models", False)

    assert TestClient(fastapi_app).get("/health").json()["models"] is True
    assert called == ["http://gpu-box.internal:8000/v1/models"]


def test_health_does_not_open_a_connection_outside_the_pool(monkeypatch):
    """db_ok and embed_dim_ok each used psycopg.connect directly, opening (and
    TLS-negotiating) a brand-new connection per healthcheck poll — the exact
    thing app/db.py's pool was introduced to stop."""
    import psycopg

    import app.health as health

    def forbidden(*args, **kwargs):
        raise AssertionError("health opened a connection outside the pool")

    monkeypatch.setattr(psycopg, "connect", forbidden)
    # Reset the memoised value so the DB is genuinely touched.
    health._embed_dim_checked = False
    health._embed_dim_ok = None

    assert health.db_ok() is True
    assert health.embed_dim_ok() is True
