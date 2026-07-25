import os
import uuid

import psycopg
import pytest
from pgvector.psycopg import register_vector

from app.ingest.embed import FakeEmbeddings
from app.library import folders as lib_folders
from app.library.organize import NothingToOrganize, organize_unfiled

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")

EMB = FakeEmbeddings(1024)


def _seed(conn, ws, filename: str, text: str) -> str:
    doc = conn.execute(
        "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
        (ws, filename),
    ).fetchone()[0]
    lit = "[" + ",".join(str(x) for x in EMB.embed([text])[0]) + "]"
    conn.execute(
        "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
        "VALUES (%s,%s,0,%s,%s::vector)",
        (doc, ws, text, lit),
    )
    return str(doc)


def _ws(conn) -> str:
    ws = uuid.uuid4()
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'o',%s)", (ws, str(ws)))
    return str(ws)


def _cleanup(ws):
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_organize_files_every_unfiled_document_and_is_deterministic():
    with psycopg.connect(DB) as conn:
        register_vector(conn)
        with conn.transaction():
            ws = _ws(conn)
            for i in range(8):
                _seed(conn, ws, f"doc{i}.txt", f"document number {i} about topic {i % 2}")
        first = organize_unfiled(conn, ws)
        # Everything is filed now, so a second run has nothing left to do.
        with pytest.raises(NothingToOrganize):
            organize_unfiled(conn, ws)
        listing = lib_folders.list_folders(conn, ws)
    try:
        assert first["organized"] == 8
        assert listing["unfiled_count"] == 0
        assert sum(f["document_count"] for f in listing["folders"]) == 8
        assert all(f["origin"] == "ai" for f in listing["folders"])
        assert all(f["reviewed"] is False for f in listing["folders"])
    finally:
        _cleanup(ws)


def test_organize_leaves_already_filed_documents_alone():
    with psycopg.connect(DB) as conn:
        register_vector(conn)
        with conn.transaction():
            ws = _ws(conn)
            kept = _seed(conn, ws, "mine.txt", "a document I filed myself")
            for i in range(5):
                _seed(conn, ws, f"other{i}.txt", f"unrelated document {i}")
        mine = lib_folders.create_folder(conn, ws, "Mine")
        lib_folders.set_document_folder(conn, ws, kept, mine["id"])
        out = organize_unfiled(conn, ws)
        row = conn.execute("SELECT folder_id FROM documents WHERE id=%s", (kept,)).fetchone()
    try:
        assert out["organized"] == 5, "only the unfiled documents should be touched"
        assert str(row[0]) == mine["id"], "a user's own filing must not be overwritten"
    finally:
        _cleanup(ws)


def test_organize_with_nothing_eligible_raises():
    with psycopg.connect(DB) as conn:
        register_vector(conn)
        with conn.transaction():
            ws = _ws(conn)
        with pytest.raises(NothingToOrganize):
            organize_unfiled(conn, ws)
    _cleanup(ws)


def test_documents_without_embeddings_are_skipped():
    with psycopg.connect(DB) as conn:
        register_vector(conn)
        with conn.transaction():
            ws = _ws(conn)
            for i in range(4):
                _seed(conn, ws, f"e{i}.txt", f"embedded document {i}")
            # A document with no chunks at all — it cannot be clustered.
            conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'empty.txt','text/plain',1,'k','indexed')",
                (ws,),
            )
        out = organize_unfiled(conn, ws)
        listing = lib_folders.list_folders(conn, ws)
    try:
        assert out["organized"] == 4
        assert listing["unfiled_count"] == 1, "the unembeddable document stays unfiled"
    finally:
        _cleanup(ws)
