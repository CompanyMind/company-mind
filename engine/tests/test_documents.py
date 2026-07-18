import os
import uuid

import psycopg
import pytest

from app.library import documents as d

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


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
            docs = d.list_documents(conn, str(ws))
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
