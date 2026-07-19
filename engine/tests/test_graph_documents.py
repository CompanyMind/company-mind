import os
import uuid

import numpy as np
import psycopg
import pytest
from pgvector.psycopg import register_vector

from app.graph import service

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")

DIM = 1024
N_PER_BLOB = 4


def _vec_lit(v):
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def _dir(axis: int, jitter_seed: int) -> list[float]:
    """A near-unit vector mostly along `axis`, with tiny deterministic jitter so
    docs in the same cluster aren't bit-identical but stay tightly grouped."""
    rng = np.random.default_rng(jitter_seed)
    v = np.zeros(DIM)
    v[axis] = 1.0
    v += rng.normal(scale=0.01, size=DIM)
    v /= np.linalg.norm(v)
    return v.tolist()


def _insert(conn, ws, did, vec, group_ids):
    conn.execute(
        "INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status)"
        " VALUES (%s,%s,%s,'text/plain',1,'k','indexed')", (did, ws, f"{did}.txt"))
    conn.execute(
        "INSERT INTO chunks (document_id,workspace_id,ordinal,text,embedding) "
        "VALUES (%s,%s,0,'doc text',%s::vector)", (did, ws, _vec_lit(vec)))
    for gid in group_ids:
        conn.execute(
            "INSERT INTO document_groups (document_id,workspace_id,group_id) "
            "VALUES (%s,%s,%s)", (did, ws, gid))


@pytest.fixture
def seeded():
    ws, ev, fin, legal = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    # Two tight, far-apart clusters: Finance docs along axis 0, Legal docs
    # along axis 1 -- near-orthogonal, so cosine similarity across clusters is
    # ~0 and well below the default 0.35 edge threshold.
    finance = [(uuid.uuid4(), _dir(0, i)) for i in range(N_PER_BLOB)]
    legal_docs = [(uuid.uuid4(), _dir(1, 100 + i)) for i in range(N_PER_BLOB)]
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            register_vector(conn)
            with conn.transaction():
                conn.execute(
                    "INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, "w", str(ws)))
                conn.execute(
                    "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
                    "VALUES (%s,%s,'Everyone','everyone',true)", (ev, ws))
                conn.execute(
                    "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
                    "VALUES (%s,%s,'Finance','finance',false)", (fin, ws))
                conn.execute(
                    "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
                    "VALUES (%s,%s,'Legal','legal',false)", (legal, ws))
                for did, vec in finance:
                    _insert(conn, ws, did, vec, [fin])
                for did, vec in legal_docs:
                    _insert(conn, ws, did, vec, [legal])
        yield {
            "ws": str(ws),
            "ev": str(ev),
            "fin": str(fin),
            "legal": str(legal),
            "finance_ids": {str(d) for d, _ in finance},
            "legal_ids": {str(d) for d, _ in legal_docs},
        }
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_document_graph_nodes_and_edges(seeded):
    ws = seeded["ws"]
    finance_ids, legal_ids = seeded["finance_ids"], seeded["legal_ids"]

    g = service.document_graph(ws, user_id="", role="owner", as_group=None)

    node_ids = {n["id"] for n in g["nodes"]}
    assert node_ids == finance_ids | legal_ids

    by_id = {n["id"]: n for n in g["nodes"]}
    for did in finance_ids:
        assert by_id[did]["department"] == "Finance"
    for did in legal_ids:
        assert by_id[did]["department"] == "Legal"
    # graph_doc_meta was never built for these docs -> defaults.
    for n in g["nodes"]:
        assert n["exposure_score"] == 0.0
        assert n["is_orphan"] is False

    # At least one intra-cluster edge at/above the default threshold (0.35),
    # and no edge crosses between the two near-orthogonal clusters.
    assert g["edges"], "expected at least one similarity edge"
    for e in g["edges"]:
        assert e["weight"] >= 0.35
        same_cluster = (
            (e["source"] in finance_ids and e["target"] in finance_ids)
            or (e["source"] in legal_ids and e["target"] in legal_ids)
        )
        assert same_cluster, f"unexpected cross-cluster edge: {e}"

    # Nodes participating in an edge have degree > 0.
    edged_ids = {e["source"] for e in g["edges"]} | {e["target"] for e in g["edges"]}
    for did in edged_ids:
        assert by_id[did]["degree"] > 0

    # Deterministic ordering.
    assert [n["id"] for n in g["nodes"]] == sorted(n["id"] for n in g["nodes"])
    assert [(e["source"], e["target"]) for e in g["edges"]] == sorted(
        (e["source"], e["target"]) for e in g["edges"]
    )


def test_document_graph_as_group_restricts_visibility(seeded):
    ws, fin = seeded["ws"], seeded["fin"]
    finance_ids, legal_ids = seeded["finance_ids"], seeded["legal_ids"]

    g = service.document_graph(ws, user_id="", role="member", as_group=fin)

    node_ids = {n["id"] for n in g["nodes"]}
    assert node_ids == finance_ids
    assert node_ids.isdisjoint(legal_ids)
    for e in g["edges"]:
        assert e["source"] in finance_ids
        assert e["target"] in finance_ids
