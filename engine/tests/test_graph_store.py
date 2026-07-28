import os
import uuid
import numpy as np
import psycopg
import pytest
from pgvector.psycopg import register_vector

from app.graph import store
from app.graph.store import load_docs
from app.ingest.embed import FakeEmbeddings

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _vec_lit(v):
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def _seed_ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def _seed(conn, ws, ev, docs):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, "w", str(ws)))
    conn.execute("INSERT INTO groups (id,workspace_id,name,slug,is_default) "
                 "VALUES (%s,%s,'Everyone','everyone',true)", (ev, ws))
    for did, vec, gid in docs:
        conn.execute("INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status)"
                     " VALUES (%s,%s,%s,'text/plain',1,'k','indexed')", (did, ws, f"{did}.txt"))
        conn.execute("INSERT INTO chunks (document_id,workspace_id,ordinal,text,embedding) "
                     "VALUES (%s,%s,0,%s,%s::vector)", (did, ws, "hello world", _vec_lit(vec)))
        conn.execute("INSERT INTO document_groups (document_id,workspace_id,group_id) "
                     "VALUES (%s,%s,%s)", (did, ws, gid))


def test_load_docs_and_write_read_roundtrip():
    ws, ev = uuid.uuid4(), uuid.uuid4()
    d1, d2 = uuid.uuid4(), uuid.uuid4()
    dim = 1024
    v1 = [1.0] + [0.0] * (dim - 1)
    v2 = [0.0, 1.0] + [0.0] * (dim - 2)
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            from pgvector.psycopg import register_vector
            register_vector(conn)
            with conn.transaction():
                _seed(conn, ws, ev, [(d1, v1, ev), (d2, v2, ev)])
            docs = store.load_docs(conn, str(ws))
            assert len(docs) == 2
            assert docs[0].vector.shape == (dim,)
            assert store.everyone_id(conn, str(ws)) == str(ev)
            # write a trivial graph and read it back
            topics = [{"label": "T", "keywords": ["k"], "centroid": v1, "x": 0.0, "y": 0.0,
                       "doc_ids": [str(d1), str(d2)]}]
            meta = {str(d1): {"topic": 0, "degree": 1, "exposure": 1.0, "orphan": False,
                              "last_retrieved_at": None},
                    str(d2): {"topic": 0, "degree": 1, "exposure": 1.0, "orphan": False,
                              "last_retrieved_at": None}}
            from app.graph.model import Finding
            findings = [Finding("orphan", str(d2), 0.9, {"max_similarity": 0.0})]
            store.write_build(conn, str(ws), topics, meta, findings)
            vis = {str(d1), str(d2)}
            read_topics = store.read_topics(conn, str(ws), vis)
            assert len(read_topics) == 1 and read_topics[0]["doc_count"] == 2
            fnd = store.read_findings(conn, str(ws), vis)
            assert len(fnd) == 1 and fnd[0]["kind"] == "orphan"
            # permission filter: a doc not visible drops from topic count + findings
            read_one = store.read_topics(conn, str(ws), {str(d1)})
            assert read_one[0]["doc_count"] == 1
            assert store.read_findings(conn, str(ws), {str(d1)}) == []
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_mean_vector_matches_numpy_mean():
    """load_docs must compute the same per-document mean as numpy did, now that
    the average is computed in Postgres via pgvector's avg(vector)."""
    import numpy as np

    ws = uuid.uuid4()
    vecs = [FakeEmbeddings(1024).embed([f"chunk {i}"])[0] for i in range(3)]
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            doc = uuid.uuid4()
            conn.execute(
                "INSERT INTO documents (id, workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,%s,'f.txt','text/plain',1,'k','indexed')",
                (doc, ws),
            )
            for i, v in enumerate(vecs):
                lit = "[" + ",".join(str(x) for x in v) + "]"
                conn.execute(
                    "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
                    "VALUES (%s,%s,%s,%s,%s::vector)",
                    (doc, ws, i, f"chunk {i}", lit),
                )
    try:
        with psycopg.connect(DB) as conn:
            register_vector(conn)
            docs = load_docs(conn, str(ws))
        assert len(docs) == 1
        expected = np.mean(np.vstack([np.array(v) for v in vecs]), axis=0)
        assert np.allclose(docs[0].vector, expected, atol=1e-5)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_job_lifecycle():
    ws = uuid.uuid4()
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,'w',%s)", (ws, str(ws)))
            jid = store.start_job(conn, str(ws))
            assert store.latest_job(conn, str(ws))["status"] == "running"
            store.finish_job(conn, str(ws), jid)
            assert store.latest_job(conn, str(ws))["status"] == "done"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


class _CountingConn:
    """Delegates to a real connection while counting statements. The N+1 in
    load_docs was invisible to every correctness test — the answer was right, it
    just cost one query per row of query_log. Counting is the only way that
    regression stays fixed."""

    def __init__(self, inner):
        self._inner = inner
        self.chunk_lookups = 0
        self.total = 0

    def execute(self, sql, params=None):
        self.total += 1
        if "SELECT DISTINCT document_id FROM chunks" in sql:
            self.chunk_lookups += 1
        return self._inner.execute(sql, params)

    def __getattr__(self, name):
        return getattr(self._inner, name)


def test_load_docs_resolves_retrieved_docs_in_one_query():
    """`retrieved` is one boolean per document. It used to cost one chunks
    lookup per row of query_log — 10k logged questions, 10k queries, twice per
    document-graph request."""
    ws, ev = uuid.uuid4(), uuid.uuid4()
    d1, d2 = uuid.uuid4(), uuid.uuid4()
    dim = 1024
    v1 = [1.0] + [0.0] * (dim - 1)
    v2 = [0.0, 1.0] + [0.0] * (dim - 2)
    with psycopg.connect(DB) as conn:
        register_vector(conn)
        with conn.transaction():
            _seed(conn, ws, ev, [(d1, v1, ev), (d2, v2, ev)])
            # The chunk that belongs to d1, cited across MANY logged questions.
            chunk = conn.execute(
                "SELECT id FROM chunks WHERE document_id=%s", (d1,)
            ).fetchone()[0]
            for _ in range(25):
                conn.execute(
                    "INSERT INTO query_log (workspace_id,user_id,question,retrieved_chunk_ids) "
                    "VALUES (%s,NULL,'q',%s)",
                    (ws, [chunk]),
                )
        counting = _CountingConn(conn)
        docs = load_docs(counting, str(ws))
    try:
        by_id = {d.id: d for d in docs}
        assert by_id[str(d1)].retrieved is True, "d1's chunk was retrieved 25 times"
        assert by_id[str(d2)].retrieved is False, "d2 was never retrieved"
        assert counting.chunk_lookups == 1, (
            f"expected one chunk lookup regardless of log size, got {counting.chunk_lookups}"
        )
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
