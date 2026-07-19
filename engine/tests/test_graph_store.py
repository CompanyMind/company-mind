import os
import uuid
import numpy as np
import psycopg
import pytest

from app.graph import store

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _vec_lit(v):
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


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
