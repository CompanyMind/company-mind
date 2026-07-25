import os
import uuid

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_probe_reports_perfect_recall_when_nothing_is_filtered():
    """Sanity check on the instrument itself: with 100% of the corpus visible and a
    large ef_search, ANN must agree with exact search. If this fails, the probe is
    wrong, not the database."""
    from evals.probe_ann import probe

    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'p',%s)", (ws, str(ws)))
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'f.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            from app.ingest.embed import FakeEmbeddings

            emb = FakeEmbeddings(1024)
            for i in range(200):
                lit = "[" + ",".join(str(x) for x in emb.embed([f"doc {i}"])[0]) + "]"
                conn.execute(
                    "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
                    "VALUES (%s,%s,%s,%s,%s::vector)",
                    (doc, ws, i, f"doc {i}", lit),
                )
    try:
        rows = probe(str(ws), ["doc 7"], selectivities=[1.0], ef_values=[200],
                     iterative_modes=["off"], limit=10)
        assert len(rows) == 1
        assert rows[0].recall == pytest.approx(1.0)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
