import os
import uuid

import psycopg
import pytest

from app.ask.service import answer_query
from app.ingest.embed import FakeEmbeddings

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _seed_ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def _seed_doc(conn, ws, text):
    doc = uuid.uuid4()
    conn.execute(
        "INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status) "
        "VALUES (%s,%s,'f.txt','text/plain',1,'k','indexed')",
        (doc, ws),
    )
    vec = FakeEmbeddings(1024).embed([text])[0]
    lit = "[" + ",".join(str(x) for x in vec) + "]"
    conn.execute(
        "INSERT INTO chunks (document_id,workspace_id,ordinal,text,page,char_start,char_end,token_count,embedding) "
        "VALUES (%s,%s,0,%s,1,0,%s,1,%s::vector)",
        (doc, ws, text, len(text), lit),
    )


def test_answer_query_logs_with_user_principal():
    ws, user = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            conn.execute(
                "INSERT INTO users (id,email,password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@e.com"),
            )
            _seed_doc(conn, ws, "Backups are retained thirty days.")
    try:
        res = answer_query(str(ws), "retention?", all_access=True, user_id=str(user))
        assert res.answer  # fake answerer returns non-empty
        with psycopg.connect(DB) as conn:
            n = conn.execute(
                "SELECT count(*) FROM query_log WHERE user_id=%s", (user,)
            ).fetchone()[0]
        assert n == 1
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
                conn.execute("DELETE FROM users WHERE id=%s", (user,))


def test_answer_query_persists_retrieval_telemetry():
    """Orchestration-level check: retrieval telemetry must actually reach the
    query_log row, not merely be computed and discarded. Read it back with SQL
    rather than trusting the function's return value — Task 14's attribution
    table is built directly from this column, so a wiring bug here (e.g. dbg
    computed but never passed to the INSERT) must fail a test."""
    ws, user = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            conn.execute(
                "INSERT INTO users (id,email,password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@e.com"),
            )
            _seed_doc(conn, ws, "Backups are retained thirty days.")
    try:
        res = answer_query(str(ws), "retention?", all_access=True, user_id=str(user))
        assert res.answer
        with psycopg.connect(DB) as conn:
            row = conn.execute(
                "SELECT degraded, timings_ms, candidate_counts, rerank_applied "
                "FROM query_log WHERE user_id=%s",
                (user,),
            ).fetchone()
        assert row is not None
        degraded, timings_ms, candidate_counts, rerank_applied = row
        assert isinstance(degraded, list)
        assert isinstance(timings_ms, dict) and "dense" in timings_ms
        assert candidate_counts == {
            "dense": 1, "lexical": 0, "fused": 1, "rerank_in": 1, "final": 1
        }
        assert isinstance(rerank_applied, bool)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
                conn.execute("DELETE FROM users WHERE id=%s", (user,))
