from fastapi.testclient import TestClient
from app.main import app


def test_health_ok():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "db" in body and "models" in body


def test_graph_routes_registered_and_secret_guarded():
    client = TestClient(app)
    paths = {r.path for r in app.routes}
    assert {
        "/graph/rebuild",
        "/graph",
        "/graph/topic/{topic_id}",
        "/graph/findings",
        "/graph/findings/{finding_id}/dismiss",
    } <= paths

    # No x-engine-secret header -> rejected before any DB/service call.
    assert client.post("/graph/rebuild", json={"workspace_id": "w"}).status_code == 401
    assert client.get("/graph", params={"workspace_id": "w"}).status_code == 401
    assert client.get("/graph/topic/t1", params={"workspace_id": "w"}).status_code == 401
    assert client.get("/graph/findings", params={"workspace_id": "w"}).status_code == 401
    assert client.post("/graph/findings/f1/dismiss", json={"workspace_id": "w"}).status_code == 401


def test_title_route_registered_and_secret_guarded():
    client = TestClient(app)
    paths = {r.path for r in app.routes}
    assert "/title" in paths
    assert client.post("/title", json={"text": "hello"}).status_code == 401
