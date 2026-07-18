import os
import uuid

import psycopg
import pytest

from app.access import resolve_access
from app.library.source import get_source
from app.ingest.embed import FakeEmbeddings

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _seed(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def _group(conn, ws, name, default=False):
    gid = uuid.uuid4()
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) VALUES (%s,%s,%s,%s,%s)",
        (gid, ws, name, f"{name}-{gid}", default),
    )
    return str(gid)


def _doc_chunk(conn, ws, text, group_id):
    doc, cid = uuid.uuid4(), uuid.uuid4()
    conn.execute(
        "INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status,extracted_text) "
        "VALUES (%s,%s,'f.txt','text/plain',1,'k','indexed',%s)",
        (doc, ws, text),
    )
    vec = FakeEmbeddings(1024).embed([text])[0]
    lit = "[" + ",".join(str(x) for x in vec) + "]"
    conn.execute(
        "INSERT INTO chunks (id,document_id,workspace_id,ordinal,text,page,char_start,char_end,token_count,embedding) "
        "VALUES (%s,%s,%s,0,%s,1,0,%s,1,%s::vector)",
        (cid, doc, ws, text, len(text), lit),
    )
    conn.execute(
        "INSERT INTO document_groups (document_id,workspace_id,group_id) VALUES (%s,%s,%s)",
        (doc, ws, group_id),
    )
    return str(cid)


def test_source_permission_owner_and_group():
    ws, user = uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed(conn, ws)
            conn.execute(
                "INSERT INTO users (id,email,password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@e.com"),
            )
            _group(conn, ws, "Everyone", True)
            fin = _group(conn, ws, "Finance")
            cid = _doc_chunk(conn, ws, "Finance secret retained thirty days.", fin)
    try:
        with psycopg.connect(DB) as conn:
            # A member with no Finance membership cannot see it.
            gids, all_access = resolve_access(conn, str(ws), str(user), "member")
            assert get_source(conn, str(ws), cid, gids, all_access) is None
            # An owner bypasses the filter.
            gids, all_access = resolve_access(conn, str(ws), str(user), "owner")
            src = get_source(conn, str(ws), cid, gids, all_access)
            assert src and "thirty days" in src["text"]
            # A member added to Finance can now see it.
            with conn.transaction():
                conn.execute(
                    "INSERT INTO group_members (workspace_id, group_id, user_id) VALUES (%s,%s,%s)",
                    (ws, fin, user),
                )
            gids, all_access = resolve_access(conn, str(ws), str(user), "member")
            src = get_source(conn, str(ws), cid, gids, all_access)
            assert src and "thirty days" in src["text"]
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
                conn.execute("DELETE FROM users WHERE id=%s", (user,))
