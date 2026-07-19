import os
import uuid

import numpy as np
import psycopg
import pytest
from pgvector.psycopg import register_vector

from app.db import get_conn
from app.graph import service

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")

DIM = 1024
N_PER_BLOB = 10


def _vec_lit(v):
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"


def _dir(axis: int, jitter_seed: int) -> list[float]:
    """A near-unit vector mostly along `axis`, with tiny deterministic jitter so
    docs in the same blob aren't bit-identical (KMeans handles this fine either
    way, but it's closer to real embeddings)."""
    rng = np.random.default_rng(jitter_seed)
    v = np.zeros(DIM)
    v[axis] = 1.0
    v += rng.normal(scale=0.01, size=DIM)
    v /= np.linalg.norm(v)
    return v.tolist()


def _seed(conn, ws, ev, fin, legal, general_docs, finance_docs, odd_doc, restricted_doc):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, "w", str(ws)))
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
        "VALUES (%s,%s,'Everyone','everyone',true)", (ev, ws))
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
        "VALUES (%s,%s,'Finance','finance',false)", (fin, ws))
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
        "VALUES (%s,%s,'Legal','legal',false)", (legal, ws))

    def _insert(did, vec, text, group_ids):
        conn.execute(
            "INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status)"
            " VALUES (%s,%s,%s,'text/plain',1,'k','indexed')", (did, ws, f"{did}.txt"))
        conn.execute(
            "INSERT INTO chunks (document_id,workspace_id,ordinal,text,embedding) "
            "VALUES (%s,%s,0,%s,%s::vector)", (did, ws, text, _vec_lit(vec)))
        for gid in group_ids:
            conn.execute(
                "INSERT INTO document_groups (document_id,workspace_id,group_id) "
                "VALUES (%s,%s,%s)", (did, ws, gid))

    for did, vec in general_docs:
        _insert(did, vec, "general onboarding policy handbook overview", [ev])
    for did, vec in finance_docs:
        _insert(did, vec, "finance budget quarterly revenue ledger report", [fin])
    odd_id, odd_vec = odd_doc
    # Mis-tagged: lives in the Finance embedding blob but only carries Everyone.
    _insert(odd_id, odd_vec, "finance budget quarterly revenue ledger report", [ev])
    restricted_id, restricted_vec = restricted_doc
    # Tagged ONLY to a third, non-default group (Legal) — never Everyone, never
    # Finance — to prove a "view as Finance" preview doesn't leak it.
    _insert(restricted_id, restricted_vec, "legal contract confidentiality clause", [legal])


@pytest.fixture
def seeded():
    ws, ev, fin, legal = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    general = [(uuid.uuid4(), _dir(0, i)) for i in range(N_PER_BLOB)]
    finance = [(uuid.uuid4(), _dir(1, 100 + i)) for i in range(N_PER_BLOB)]
    odd = (uuid.uuid4(), _dir(1, 999))
    restricted = (uuid.uuid4(), _dir(0, 500))
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            register_vector(conn)
            with conn.transaction():
                _seed(conn, ws, ev, fin, legal, general, finance, odd, restricted)
        yield {
            "ws": str(ws),
            "odd": str(odd[0]),
            "ev": str(ev),
            "fin": str(fin),
            "legal": str(legal),
            "restricted": str(restricted[0]),
            "general_ids": {str(d) for d, _ in general},
            "finance_ids": {str(d) for d, _ in finance},
        }
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_build_produces_topics_and_flags_anomaly(seeded):
    ws, odd, fin = seeded["ws"], seeded["odd"], seeded["fin"]
    restricted = seeded["restricted"]
    general_ids, finance_ids = seeded["general_ids"], seeded["finance_ids"]

    job = service.build_graph(ws)
    assert job["status"] == "done"

    g = service.get_graph(ws, user_id="", role="owner", as_group=None)
    assert len(g["topics"]) >= 1
    total_docs = sum(t["doc_count"] for t in g["topics"])
    assert total_docs == 2 * N_PER_BLOB + 2  # general + finance + odd + restricted

    findings = service.list_findings(ws, user_id="", role="owner", as_group=None, kind=None)
    assert any(
        f["document_id"] == odd and f["kind"] == "permission_anomaly" for f in findings
    )

    # get_topic: find the topic containing the odd doc; it should hold the
    # whole Finance blob (odd doc clustered with Finance by embedding).
    containing = None
    for t in g["topics"]:
        nodes = service.get_topic(ws, t["id"], user_id="", role="owner", as_group=None)["nodes"]
        ids = {n["id"] for n in nodes}
        if odd in ids:
            containing = ids
            break
    assert containing is not None
    assert len(containing) >= N_PER_BLOB  # odd doc clustered with the Finance blob

    # Owner / None sees everything, including all three doc classes.
    with get_conn() as conn:
        owner_vis = service._visible(conn, ws, user_id="", role="owner", as_group=None)
    assert finance_ids <= owner_vis
    assert general_ids <= owner_vis
    assert restricted in owner_vis

    # _visible: "view as Finance" must match what a real Finance member sees
    # via resolve_access — their own group PLUS the default Everyone group.
    # That means it INCLUDES the Everyone-tagged general blob and the
    # mis-tagged odd doc (both carry only the Everyone group), and EXCLUDES
    # the doc tagged to the unrelated Legal group.
    with get_conn() as conn:
        vis = service._visible(conn, ws, user_id="", role="member", as_group=fin)
    assert finance_ids <= vis
    assert general_ids <= vis
    assert odd in vis
    assert restricted not in vis
    assert len(vis) == 2 * N_PER_BLOB + 1  # finance + general + odd, not restricted

    # dismiss_finding: dismissing the flagged finding removes it from later reads.
    flagged = next(f for f in findings if f["document_id"] == odd and f["kind"] == "permission_anomaly")
    assert service.dismiss_finding(ws, flagged["id"]) is True
    findings_after = service.list_findings(ws, user_id="", role="owner", as_group=None, kind=None)
    assert all(f["id"] != flagged["id"] for f in findings_after)
