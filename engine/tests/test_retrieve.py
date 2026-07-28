import os
import uuid

import psycopg
import pytest
from psycopg_pool import ConnectionPool, PoolTimeout

import app.ask.retrieve as retrieve_mod
import app.db as db_mod
from app.ask.retrieve import retrieve
from app.ingest.embed import FakeEmbeddings
from app.settings import settings

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


def test_retrieve_does_not_hold_a_connection_during_rerank(monkeypatch):
    """Regression test for the connection-lifetime bug in retrieve(): reranking is
    a network call (LLMReranker/CrossEncoderReranker, timeout=60s) and must not
    hold one of the shared pool's connections while it runs — the identical defect
    class Task 4 fixed on ingest (engine/app/ingest/store.py). The pool has ten
    connections shared by ask, ingest, the Telegram worker, and Atlas; a slow or
    degraded rerank backend under concurrent asks would otherwise burn through it
    and produce PoolTimeout on unrelated lightweight requests.

    Shrinks the pool to a single connection and proves it's free to acquire
    *while reranker.rerank(...) is executing* — if retrieve() still held a
    connection at that point, the acquire below blocks until PoolTimeout and the
    test fails."""
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            _seed_doc(conn, ws, "alpha content about pgvector")

    original_pool = db_mod._pool
    test_pool = ConnectionPool(
        settings.database_url,
        min_size=1,
        max_size=1,
        configure=db_mod._configure,
        open=True,
    )
    test_pool.wait(timeout=5)
    acquired: dict[str, bool | None] = {"ok": None}

    class SpyReranker:
        def rerank(self, query, items, top_k, degraded=None):
            try:
                with test_pool.connection(timeout=0.5):
                    acquired["ok"] = True
            except PoolTimeout:
                acquired["ok"] = False
            return [it.chunk_id for it in items[:top_k]]

    monkeypatch.setattr(retrieve_mod, "get_reranker", lambda: SpyReranker())
    db_mod._pool = test_pool
    try:
        hits, dbg = retrieve(str(ws), "pgvector", k=5, all_access=True)
        assert acquired["ok"] is True, (
            "reranker.rerank could not acquire the pool's only connection — "
            "retrieve() is holding one across the rerank HTTP call"
        )
        assert len(hits) == 1
        assert hits[0].text == "alpha content about pgvector"
    finally:
        db_mod._pool = original_pool
        test_pool.close()
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


class _CountingConn:
    """Delegates to a real connection while counting neighbour-window lookups."""

    def __init__(self, inner):
        self._inner = inner
        self.window_queries = 0

    def execute(self, sql, params=None):
        if "SELECT document_id, ordinal, text FROM chunks" in sql or (
            "SELECT text FROM chunks" in sql and "ordinal BETWEEN" in sql
        ):
            self.window_queries += 1
        return self._inner.execute(sql, params)

    def __getattr__(self, name):
        return getattr(self._inner, name)


def _seed_multi_chunk_doc(conn, ws, texts: list[str]) -> str:
    """One document with several consecutive chunks."""
    doc = uuid.uuid4()
    conn.execute(
        "INSERT INTO documents (id, workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'multi.txt','text/plain',1,'k','indexed')",
        (doc, ws),
    )
    for ordinal, text in enumerate(texts):
        vec = FakeEmbeddings(1024).embed([text])[0]
        lit = "[" + ",".join(str(x) for x in vec) + "]"
        conn.execute(
            "INSERT INTO chunks (document_id, workspace_id, ordinal, text, page, "
            "char_start, char_end, token_count, embedding) "
            "VALUES (%s,%s,%s,%s,1,0,%s,1,%s::vector)",
            (doc, ws, ordinal, text, len(text), lit),
        )
    return str(doc)


def test_neighbor_expansion_joins_the_surrounding_chunks_in_one_query():
    """`context` is ordinal-1, ordinal, ordinal+1 concatenated in order, so a
    heading or caveat split across a chunk boundary comes back with its body.
    It used to cost one query per result — final_k of them, in series, inside
    the latency the person is waiting through.
    """
    ws = uuid.uuid4()
    texts = ["alpha heading", "beta the important body", "gamma trailing caveat", "delta unrelated"]
    with psycopg.connect(DB) as conn:
        conn.autocommit = True
        conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,'r',%s)", (ws, str(ws)))
        doc = _seed_multi_chunk_doc(conn, str(ws), texts)
        rows = conn.execute(
            "SELECT id, ordinal FROM chunks WHERE document_id=%s ORDER BY ordinal", (doc,)
        ).fetchall()
        by_ordinal = {r[1]: str(r[0]) for r in rows}

        from app.ask.retrieve import Retrieved, _expand_neighbors

        meta = {by_ordinal[o]: {"ordinal": o} for o in by_ordinal}
        results = [
            Retrieved(by_ordinal[1], doc, "multi.txt", 1, 0, 1, texts[1], 0.0, texts[1]),
            Retrieved(by_ordinal[2], doc, "multi.txt", 1, 0, 1, texts[2], 0.0, texts[2]),
        ]
        counting = _CountingConn(conn)
        _expand_neighbors(counting, str(ws), results, meta)
    try:
        # ordinal 1 pulls 0,1,2 — in order.
        assert results[0].context == "\n".join(texts[0:3])
        # ordinal 2 pulls 1,2,3.
        assert results[1].context == "\n".join(texts[1:4])
        # The matched span itself is untouched: citations point at it.
        assert results[0].text == texts[1]
        assert counting.window_queries == 1, (
            f"expected one query for all results, got {counting.window_queries}"
        )
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_neighbor_expansion_at_a_document_edge_falls_back_to_what_exists():
    """ordinal 0 has no predecessor; the window must not go empty or error."""
    ws = uuid.uuid4()
    texts = ["only heading", "second chunk"]
    with psycopg.connect(DB) as conn:
        conn.autocommit = True
        conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,'r',%s)", (ws, str(ws)))
        doc = _seed_multi_chunk_doc(conn, str(ws), texts)
        rows = conn.execute(
            "SELECT id, ordinal FROM chunks WHERE document_id=%s ORDER BY ordinal", (doc,)
        ).fetchall()
        by_ordinal = {r[1]: str(r[0]) for r in rows}

        from app.ask.retrieve import Retrieved, _expand_neighbors

        meta = {by_ordinal[o]: {"ordinal": o} for o in by_ordinal}
        results = [Retrieved(by_ordinal[0], doc, "multi.txt", 1, 0, 1, texts[0], 0.0, texts[0])]
        _expand_neighbors(conn, str(ws), results, meta)
    try:
        assert results[0].context == "\n".join(texts)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
