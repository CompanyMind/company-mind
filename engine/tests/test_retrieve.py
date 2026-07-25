import os
import uuid

import psycopg
import pytest

from app.ask.retrieve import retrieve
from app.ingest.embed import FakeEmbeddings

DB = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _seed_doc(conn, ws, text) -> str:
    """Insert a document + one chunk in an existing workspace. Returns doc id."""
    doc = uuid.uuid4()
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
    return str(doc)


def _seed_ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def _tag(conn, doc_id, ws, group_name) -> str:
    gid = uuid.uuid4()
    conn.execute(
        "INSERT INTO groups (id, workspace_id, name, slug, is_default) VALUES (%s,%s,%s,%s,false)",
        (gid, ws, group_name, f"{group_name}-{gid}"),
    )
    conn.execute(
        "INSERT INTO document_groups (document_id, workspace_id, group_id) VALUES (%s,%s,%s)",
        (doc_id, ws, gid),
    )
    return str(gid)


def test_retrieval_is_workspace_scoped():
    ws1, ws2 = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws1)
            _seed_ws(conn, ws2)
            _seed_doc(conn, ws1, "alpha content about pgvector")
            _seed_doc(conn, ws2, "beta content about something else")
    try:
        hits, dbg = retrieve(str(ws1), "pgvector", k=5, all_access=True)
        assert len(hits) == 1
        assert hits[0].text == "alpha content about pgvector"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id IN (%s,%s)", (ws1, ws2))


def test_lexical_retrieves_exact_token_without_semantic_overlap():
    # FakeEmbeddings is not semantic, so among many noise docs a dense-only search
    # cannot reliably float the exact-token doc to the top. Lexical + RRF must.
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            for i in range(20):
                _seed_doc(conn, ws, f"noise document number {i} about weather and lunch")
            _seed_doc(conn, ws, "the flag CKPT_PREFETCH controls warmup")
    try:
        hits, dbg = retrieve(str(ws), "CKPT_PREFETCH", all_access=True)
        assert hits, "expected at least one hit"
        assert "CKPT_PREFETCH" in hits[0].text  # lexical + RRF floats it to the top
        assert dbg.lexical_n > 0, "the lexical arm must fire for an exact-token query"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_retrieval_respects_group_filter():
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            d_a = _seed_doc(conn, ws, "alpha secret about finance")
            d_b = _seed_doc(conn, ws, "beta secret about legal")
            ga = _tag(conn, d_a, ws, "A")
            _tag(conn, d_b, ws, "B")
    try:
        only_a, _ = retrieve(str(ws), "secret", k=10, group_ids=[ga], all_access=False)
        assert {r.text for r in only_a} == {"alpha secret about finance"}
        both, _ = retrieve(str(ws), "secret", k=10, all_access=True)
        assert len(both) == 2
        # A member with no groups sees nothing group-restricted.
        none, _ = retrieve(str(ws), "secret", k=10, group_ids=[], all_access=False)
        assert none == []
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
