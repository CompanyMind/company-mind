import os
import uuid

import psycopg
import pytest

from app.ask.retrieve import retrieve
from app.ingest.embed import FakeEmbeddings

DB = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _seed(conn, ws, text):
    doc = uuid.uuid4()
    conn.execute(
        "INSERT INTO workspaces (id, name, slug) VALUES (%s,%s,%s)",
        (ws, f"ws-{ws}", str(ws)),
    )
    conn.execute(
        "INSERT INTO documents (id, workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'f.txt','text/plain',1,'k','indexed')",
        (doc, ws),
    )
    vec = FakeEmbeddings(1024).embed([text])[0]
    lit = "[" + ",".join(str(x) for x in vec) + "]"
    conn.execute(
        "INSERT INTO chunks (document_id, workspace_id, ordinal, text, page, char_start, char_end, token_count, embedding) "
        "VALUES (%s,%s,0,%s,1,0,%s,1,%s::vector)",
        (doc, ws, text, len(text), lit),
    )


def test_retrieval_is_workspace_scoped():
    ws1, ws2 = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed(conn, ws1, "alpha content about pgvector")
            _seed(conn, ws2, "beta content about something else")
    try:
        hits = retrieve(str(ws1), "pgvector", k=5)
        assert len(hits) == 1
        assert hits[0].text == "alpha content about pgvector"
        assert hits[0].filename == "f.txt"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id IN (%s,%s)", (ws1, ws2))
