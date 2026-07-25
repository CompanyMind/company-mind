import os
import uuid

import psycopg
import pytest

from app.library import folders as lib_folders
from app.library.suggest import suggest_questions

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_suggestions_never_reference_documents_the_caller_cannot_see():
    """A suggested question is a disclosure. Offering 'What is the Band 4 salary
    range?' to someone who cannot open the HR file leaks both its existence and
    its topic."""
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'s',%s)", (ws, str(ws)))
            everyone = uuid.uuid4()
            hr = uuid.uuid4()
            conn.execute(
                "INSERT INTO groups (id, workspace_id, name, slug, is_default) "
                "VALUES (%s,%s,'Everyone',%s,true)",
                (everyone, ws, f"ev-{everyone}"),
            )
            conn.execute(
                "INSERT INTO groups (id, workspace_id, name, slug, is_default) "
                "VALUES (%s,%s,'HR',%s,false)",
                (hr, ws, f"hr-{hr}"),
            )
            docs = {}
            for name, group in (("open.txt", everyone), ("secret.txt", hr)):
                d = conn.execute(
                    "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                    "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
                    (ws, name),
                ).fetchone()[0]
                conn.execute(
                    "INSERT INTO document_groups (document_id, workspace_id, group_id) "
                    "VALUES (%s,%s,%s)",
                    (d, ws, group),
                )
                docs[name] = str(d)
        public = lib_folders.create_folder(conn, str(ws), "Retention", origin="ai",
                                           keywords=["retention", "records"])
        private = lib_folders.create_folder(conn, str(ws), "Compensation", origin="ai",
                                            keywords=["salary", "band"])
        lib_folders.set_document_folder(conn, str(ws), docs["open.txt"], public["id"])
        lib_folders.set_document_folder(conn, str(ws), docs["secret.txt"], private["id"])

        member = suggest_questions(conn, str(ws), str(uuid.uuid4()), "member")
        owner = suggest_questions(conn, str(ws), str(uuid.uuid4()), "owner")
    try:
        assert any("Retention" in q for q in member)
        assert not any("Compensation" in q for q in member), member
        assert any("Compensation" in q for q in owner), owner
        assert len(owner) <= 3
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_no_visible_folders_yields_no_questions():
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'s2',%s)", (ws, str(ws)))
        assert suggest_questions(conn, str(ws), str(uuid.uuid4()), "owner") == []
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
