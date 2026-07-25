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
        assert rows[0].n_gold == 10  # limit=10, and everything is visible
        assert rows[0].recall == pytest.approx(1.0)
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def _seed_corpus(conn, ws, doc, n: int) -> None:
    from app.ingest.embed import FakeEmbeddings

    emb = FakeEmbeddings(1024)
    for i in range(n):
        lit = "[" + ",".join(str(x) for x in emb.embed([f"doc {i}"])[0]) + "]"
        conn.execute(
            "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
            "VALUES (%s,%s,%s,%s,%s::vector)",
            (doc, ws, i, f"doc {i}", lit),
        )


def _seed_ws_and_corpus(n: int):
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'p',%s)", (ws, str(ws)))
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'f.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            _seed_corpus(conn, ws, doc, n)
    return ws


def test_visible_predicate_selects_roughly_the_requested_fraction():
    """The hash expression in _visible_predicate is the most delicate line in the
    module (avoiding the int4-overflow trap via bit(32)::bigint) and the only test
    that exercises the real (non-early-return) path. A corpus of 300+ chunks keeps
    the observed fraction close to the requested one — this is a hash, not a
    guarantee, hence the generous tolerance."""
    from evals.probe_ann import _visible_predicate

    ws = _seed_ws_and_corpus(300)
    try:
        pred = _visible_predicate(0.25)
        with psycopg.connect(DB) as conn:
            total = conn.execute(
                "SELECT count(*) FROM chunks c WHERE c.workspace_id = %s", (ws,)
            ).fetchone()[0]
            selected = conn.execute(
                f"SELECT count(*) FROM chunks c WHERE c.workspace_id = %s AND {pred}", (ws,)
            ).fetchone()[0]
        fraction = selected / total
        assert total == 300
        assert fraction == pytest.approx(0.25, abs=0.08), (
            f"requested selectivity 0.25, observed {fraction} ({selected}/{total})"
        )
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_probe_reports_zero_gold_honestly_not_as_fabricated_perfect_recall():
    """A selectivity of 0.0 filters out the entire corpus. The old code reported
    recall=1.0 for this — indistinguishable from a genuine 40/40 match. It must
    instead report n_gold=0 and recall=None."""
    from evals.probe_ann import probe

    ws = _seed_ws_and_corpus(300)
    try:
        rows = probe(str(ws), ["doc 7"], selectivities=[0.0], ef_values=[200],
                     iterative_modes=["off"], limit=10)
        assert len(rows) == 1
        assert rows[0].n_gold == 0
        assert rows[0].recall is None
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_probe_reports_usable_rows_under_a_filtered_selectivity():
    """A filtered (non-trivial, non-zero) selectivity must exercise the real hash
    predicate and produce a row with a genuine ground-truth size and a recall in
    [0.0, 1.0] — not asserting a specific recall value (that would be flaky under
    FakeEmbeddings' uniform-on-sphere distribution), only that the instrument
    reports something usable."""
    from evals.probe_ann import probe

    ws = _seed_ws_and_corpus(300)
    try:
        rows = probe(str(ws), ["doc 7", "doc 42"], selectivities=[0.5],
                     ef_values=[40, 200], iterative_modes=["off"], limit=10)
        assert len(rows) == 2
        for row in rows:
            assert row.n_gold > 0
            assert row.recall is not None
            assert 0.0 <= row.recall <= 1.0
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
