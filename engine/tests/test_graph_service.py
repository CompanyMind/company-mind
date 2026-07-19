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


def _seed(conn, ws, ev, fin, general_docs, finance_docs, odd_doc):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, "w", str(ws)))
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
        "VALUES (%s,%s,'Everyone','everyone',true)", (ev, ws))
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
        "VALUES (%s,%s,'Finance','finance',false)", (fin, ws))

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


@pytest.fixture
def seeded():
    ws, ev, fin = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    general = [(uuid.uuid4(), _dir(0, i)) for i in range(N_PER_BLOB)]
    finance = [(uuid.uuid4(), _dir(1, 100 + i)) for i in range(N_PER_BLOB)]
    odd = (uuid.uuid4(), _dir(1, 999))
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            register_vector(conn)
            with conn.transaction():
                _seed(conn, ws, ev, fin, general, finance, odd)
        yield str(ws), str(odd[0]), str(ev), str(fin)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_build_produces_topics_and_flags_anomaly(seeded):
    ws, odd, ev, fin = seeded
    job = service.build_graph(ws)
    assert job["status"] == "done"

    g = service.get_graph(ws, user_id="", role="owner", as_group=None)
    assert len(g["topics"]) >= 1
    total_docs = sum(t["doc_count"] for t in g["topics"])
    assert total_docs == 2 * N_PER_BLOB + 1

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

    # _visible: a restricted Finance-group view hides the general blob AND the
    # mis-tagged odd doc (which is exactly the permission bug lenses caught).
    with get_conn() as conn:
        vis = service._visible(conn, ws, user_id="", role="member", as_group=fin)
    assert odd not in vis
    assert len(vis) == N_PER_BLOB  # only the correctly Finance-tagged docs

    # dismiss_finding: dismissing the flagged finding removes it from later reads.
    flagged = next(f for f in findings if f["document_id"] == odd and f["kind"] == "permission_anomaly")
    assert service.dismiss_finding(ws, flagged["id"]) is True
    findings_after = service.list_findings(ws, user_id="", role="owner", as_group=None, kind=None)
    assert all(f["id"] != flagged["id"] for f in findings_after)
