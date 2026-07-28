"""No pooled connection may be held across a model call.

The pool has ten connections and is shared by ask, ingest, the Telegram worker
and Atlas. A chat call has a 60-120s timeout. Holding a connection across one
therefore does not slow the product down, it takes it down: three owners
clicking "AI organise" while a fourth asks a question is enough.

The codebase already states this invariant three times in prose —
`retrieve.py`'s three-phase comment, `prepare.py`'s docstring, and
`firms.ts::createFirm` ("the pool-starvation mistake this codebase has already
paid for twice"). It was still violated in three places. Prose is not a test.
"""

import os
import uuid

import psycopg
import pytest
from pgvector.psycopg import register_vector

from app.graph import service as graph_service
from app.ingest.embed import FakeEmbeddings
from app.library import organize as lib_organize
from app.library import suggest as lib_suggest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")

EMB = FakeEmbeddings(1024)


class Probe:
    """Stands in for the chat client, recording connections held at call time."""

    def __init__(self, held) -> None:
        self._held = held
        self.observations: list[int] = []

    def __call__(self, prompt: str) -> str:
        self.observations.append(self._held())
        return "Some Label"

    def assert_never_held_a_connection(self) -> None:
        assert self.observations, "the model was never called — the probe proved nothing"
        assert all(n == 0 for n in self.observations), (
            f"a pooled connection was held across a model call: {self.observations}"
        )


def _seed_workspace(conn, ws: str, n: int = 8) -> None:
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,'nc',%s)", (ws, ws))
    conn.execute(
        "INSERT INTO groups (workspace_id,name,slug,is_default) VALUES (%s,'Everyone',%s,true)",
        (ws, f"ev-{ws}"),
    )
    for i in range(n):
        doc = conn.execute(
            "INSERT INTO documents (workspace_id,filename,mime,bytes,storage_key,status) "
            "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
            (ws, f"doc{i}.txt"),
        ).fetchone()[0]
        text = f"document number {i} concerning topic {i % 2} and its handling"
        lit = "[" + ",".join(str(x) for x in EMB.embed([text])[0]) + "]"
        conn.execute(
            "INSERT INTO chunks (document_id,workspace_id,ordinal,text,embedding) "
            "VALUES (%s,%s,0,%s,%s::vector)",
            (doc, ws, text, lit),
        )
        conn.execute(
            "INSERT INTO document_groups (document_id, workspace_id, group_id) "
            "SELECT %s,%s,id FROM groups WHERE workspace_id=%s AND is_default=true",
            (doc, ws, ws),
        )


@pytest.fixture
def workspace():
    ws = str(uuid.uuid4())
    with psycopg.connect(DB) as conn:
        register_vector(conn)
        with conn.transaction():
            _seed_workspace(conn, ws)
    yield ws
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_ai_organise_does_not_hold_a_connection_across_labelling(
    workspace, monkeypatch, track_checkouts
):
    with track_checkouts(lib_organize) as held:
        probe = Probe(held)
        monkeypatch.setattr(lib_organize, "get_chat_call", lambda: probe)
        result = lib_organize.organize_unfiled_pooled(workspace)

    assert result["organized"] == 8
    probe.assert_never_held_a_connection()


def test_suggestions_do_not_hold_a_connection_across_generation(
    workspace, monkeypatch, track_checkouts
):
    # Suggestions are drawn from folders, so file the documents first.
    lib_organize.organize_unfiled_pooled(workspace)

    with track_checkouts(lib_suggest) as held:
        probe = Probe(held)
        monkeypatch.setattr(lib_suggest, "get_chat_call", lambda: probe)
        questions = lib_suggest.suggest_questions_pooled(workspace, "", "owner")

    assert questions, "expected at least one suggested question"
    probe.assert_never_held_a_connection()


def test_atlas_build_does_not_hold_a_connection_across_topic_labelling(
    workspace, monkeypatch, track_checkouts
):
    with track_checkouts(graph_service) as held:
        probe = Probe(held)
        monkeypatch.setattr(graph_service, "get_chat_call", lambda: probe)
        job = graph_service.build_graph(workspace)

    assert job["status"] == "done"
    probe.assert_never_held_a_connection()
