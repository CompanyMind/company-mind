import os
import uuid

import psycopg
import pytest

from app.library import documents as d

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def test_delete_document_takes_its_derived_rows_and_returns_the_storage_key():
    """Deleting must clear the retrievable copy, not just the listing row.

    A document whose chunks survived would keep being retrieved and cited after
    the owner deleted it — the worst possible failure for a product whose claim
    is that an answer traces to a source you still hold.
    """
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _ws(conn, ws)
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            doc = d.create_document(
                conn, str(ws), "report.pdf", "application/pdf", 1234, "k/report.pdf"
            )
            conn.execute(
                "INSERT INTO chunks (document_id, workspace_id, ordinal, text) "
                "VALUES (%s,%s,0,'body')",
                (doc["id"], str(ws)),
            )

            key = d.delete_document(conn, str(ws), doc["id"])

            # web owns the bytes on disk; it needs this to finish the job.
            assert key == "k/report.pdf"
            assert d.list_documents(conn, str(ws), None, [], True) == []
            for table in ("chunks", "ingestion_jobs", "document_groups"):
                left = conn.execute(
                    f"SELECT count(*) FROM {table} WHERE document_id=%s", (doc["id"],)
                ).fetchone()[0]
                assert left == 0, f"{table} survived the delete"
            # Idempotent-ish: a second delete reports "there was nothing", which is
            # what turns a double-clicked button into a 404 rather than a 500.
            assert d.delete_document(conn, str(ws), doc["id"]) is None
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_delete_document_is_scoped_to_its_workspace():
    ws, other = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _ws(conn, ws)
            _ws(conn, other)
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            doc = d.create_document(conn, str(ws), "a.txt", "text/plain", 1, "k/a.txt")
            assert d.delete_document(conn, str(other), doc["id"]) is None
            assert len(d.list_documents(conn, str(ws), None, [], True)) == 1
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id IN (%s,%s)", (ws, other))


def test_create_and_list_documents():
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _ws(conn, ws)
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            doc = d.create_document(
                conn, str(ws), "report.pdf", "application/pdf", 1234, "k/report.pdf"
            )
            assert doc["status"] == "uploaded"
            assert len(doc["group_ids"]) == 1  # defaulted to Everyone
            docs = d.list_documents(conn, str(ws), None, [], True)
            assert len(docs) == 1 and docs[0]["filename"] == "report.pdf"
            assert docs[0]["group_ids"] == doc["group_ids"]
            n = conn.execute(
                "SELECT count(*) FROM ingestion_jobs WHERE document_id=%s", (doc["id"],)
            ).fetchone()[0]
            assert n == 1
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
