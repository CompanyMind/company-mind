import os
import uuid

import psycopg
import pytest

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def test_deleting_a_document_preserves_citations():
    """The owner-facing delete in Sources removes the source for good. Answers
    already given must keep their quoted evidence — an audit trail that rewrites
    itself when the underlying file is deleted is not an audit trail. The links
    go dead (both ids null out), the words stay."""
    ws, user = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'ws',%s)", (ws, str(ws)))
            conn.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@example.test"),
            )
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'policy.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            chunk = conn.execute(
                "INSERT INTO chunks (document_id, workspace_id, ordinal, text) "
                "VALUES (%s,%s,0,'retention is 7 years') RETURNING id",
                (doc, ws),
            ).fetchone()[0]
            chat = conn.execute(
                "INSERT INTO chats (workspace_id, user_id) VALUES (%s,%s) RETURNING id", (ws, user)
            ).fetchone()[0]
            msg = conn.execute(
                "INSERT INTO messages (chat_id, workspace_id, role, content) "
                "VALUES (%s,%s,'assistant','Retention is 7 years [1]') RETURNING id",
                (chat, ws),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO citations (message_id, workspace_id, chunk_id, marker, document_id, "
                "filename, page, snippet) VALUES (%s,%s,%s,1,%s,'policy.txt',1,'retention is 7 years')",
                (msg, ws, chunk, doc),
            )

        with conn.transaction():
            conn.execute("DELETE FROM documents WHERE id=%s AND workspace_id=%s", (doc, ws))

        row = conn.execute(
            "SELECT chunk_id, document_id, filename, snippet FROM citations WHERE message_id=%s",
            (msg,),
        ).fetchone()

        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
            conn.execute("DELETE FROM users WHERE id=%s", (user,))

    assert row is not None, "deleting the document cascaded into the audit trail"
    assert row[0] is None and row[1] is None, "both references must null out, not dangle"
    assert row[2] == "policy.txt", "the frozen filename is what makes the citation still readable"
    assert row[3] == "retention is 7 years"


def test_reingest_preserves_citations():
    """Re-ingesting a document must not destroy the audit trail. store.py deletes
    and re-creates every chunk on re-ingest; a citation is evidence for an answer
    that was already given, so it must survive with its snippet intact."""
    ws, user = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO workspaces (id, name, slug) VALUES (%s,'ws',%s)", (ws, str(ws))
            )
            conn.execute(
                "INSERT INTO users (id, email, password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@example.test"),
            )
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'policy.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            chunk = conn.execute(
                "INSERT INTO chunks (document_id, workspace_id, ordinal, text) "
                "VALUES (%s,%s,0,'retention is 7 years') RETURNING id",
                (doc, ws),
            ).fetchone()[0]
            chat = conn.execute(
                "INSERT INTO chats (workspace_id, user_id) VALUES (%s,%s) RETURNING id", (ws, user)
            ).fetchone()[0]
            msg = conn.execute(
                "INSERT INTO messages (chat_id, workspace_id, role, content) "
                "VALUES (%s,%s,'assistant','Retention is 7 years [1]') RETURNING id",
                (chat, ws),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO citations (message_id, workspace_id, chunk_id, marker, document_id, "
                "filename, page, snippet) VALUES (%s,%s,%s,1,%s,'policy.txt',1,'retention is 7 years')",
                (msg, ws, chunk, doc),
            )

        # Exactly what ingest/store.py does on re-ingest.
        with conn.transaction():
            conn.execute("DELETE FROM chunks WHERE document_id=%s AND workspace_id=%s", (doc, ws))

        row = conn.execute(
            "SELECT chunk_id, snippet, marker FROM citations WHERE message_id=%s", (msg,)
        ).fetchone()

        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
            conn.execute("DELETE FROM users WHERE id=%s", (user,))

    assert row is not None, "the citation was destroyed by re-ingest"
    assert row[0] is None, "chunk_id should be NULL, not dangling"
    assert row[1] == "retention is 7 years", "the quoted evidence must survive"
    assert row[2] == 1
