import os
import uuid

import psycopg
import pytest
from psycopg_pool import ConnectionPool, PoolTimeout

import app.db as db_mod
import app.ingest.store as store_mod
from app.ingest.prepare import prepare_document as real_prepare_document
from app.ingest.store import process_document
from app.library import documents as doclib
from app.settings import settings

DB = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _seed(conn, ws, filename="notes.txt", mime="text/plain") -> str:
    """Insert a workspace + a queued document/ingestion_job in it, the same way
    the upload endpoint does via app.library.documents.create_document."""
    conn.execute(
        "INSERT INTO workspaces (id, name, slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws))
    )
    doc = doclib.create_document(conn, str(ws), filename, mime, 100, f"k/{filename}")
    return doc["id"]


def _cleanup(ws) -> None:
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_process_document_does_not_hold_a_connection_during_prepare(monkeypatch):
    """Regression test for the bug this task fixes: process_document used to hold
    one of the pool's connections for the whole function, including the embedding
    HTTP call. Here we shrink the pool to a single connection and prove one is
    available to acquire *while prepare_document is running* — if process_document
    still held a connection at that point (e.g. a future regression re-wraps the
    prepare_document(...) call inside the phase-1 `with get_conn()` block), the
    acquire below blocks until PoolTimeout and the test fails."""
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        conn.autocommit = True
        doc_id = _seed(conn, ws)

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

    def spy(filename, mime, data, mode):
        try:
            with test_pool.connection(timeout=0.5):
                acquired["ok"] = True
        except PoolTimeout:
            acquired["ok"] = False
        return real_prepare_document(filename, mime, data, mode)

    monkeypatch.setattr(store_mod, "prepare_document", spy)
    db_mod._pool = test_pool
    try:
        process_document(doc_id, str(ws), "notes.txt", "text/plain", b"alpha beta gamma")
        assert acquired["ok"] is True, (
            "prepare_document could not acquire the pool's only connection — "
            "process_document is holding one across the embedding call"
        )
    finally:
        db_mod._pool = original_pool
        test_pool.close()
        _cleanup(ws)


def test_zero_chunk_document_is_recorded_as_failed():
    """A document that parses to zero chunks (every scanned PDF, or here a
    whitespace-only text file) must not look like a successful, empty ingest."""
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        conn.autocommit = True
        doc_id = _seed(conn, ws, filename="blank.txt")
    try:
        process_document(doc_id, str(ws), "blank.txt", "text/plain", b"   \n\t  ")
        with psycopg.connect(DB) as conn:
            row = conn.execute(
                "SELECT status, error FROM documents WHERE id=%s", (doc_id,)
            ).fetchone()
        assert row[0] == "failed"
        assert row[1] is not None and "0 chunks" in row[1]
    finally:
        _cleanup(ws)


def test_failure_handler_records_both_tables(monkeypatch):
    """A failure anywhere in the prepare phase must land in both `documents`
    (the UI's status) and `ingestion_jobs` (the job history) — not just one."""
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        conn.autocommit = True
        doc_id = _seed(conn, ws)

    def boom(*args, **kwargs):
        raise RuntimeError("simulated prepare failure")

    monkeypatch.setattr(store_mod, "prepare_document", boom)
    try:
        process_document(doc_id, str(ws), "notes.txt", "text/plain", b"alpha beta gamma")
        with psycopg.connect(DB) as conn:
            doc_row = conn.execute(
                "SELECT status, error FROM documents WHERE id=%s", (doc_id,)
            ).fetchone()
            job_row = conn.execute(
                "SELECT status, error, finished_at FROM ingestion_jobs WHERE document_id=%s",
                (doc_id,),
            ).fetchone()
        assert doc_row == ("failed", "simulated prepare failure")
        assert job_row[0] == "failed"
        assert job_row[1] == "simulated prepare failure"
        assert job_row[2] is not None
    finally:
        _cleanup(ws)
