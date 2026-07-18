import os
import uuid

import psycopg
import pytest

from app.telegram.handler import handle_update, REQUESTED, PENDING
from app.ingest.embed import FakeEmbeddings

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _seed_ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def _everyone(conn, ws):
    gid = uuid.uuid4()
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) VALUES (%s,%s,'Everyone','everyone',true)",
        (gid, ws),
    )
    return str(gid)


def _group(conn, ws, name):
    gid = uuid.uuid4()
    conn.execute(
        "INSERT INTO groups (id,workspace_id,name,slug,is_default) VALUES (%s,%s,%s,%s,false)",
        (gid, ws, name, f"{name}-{gid}"),
    )
    return str(gid)


def _doc(conn, ws, text, group_id):
    doc = uuid.uuid4()
    conn.execute(
        "INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status) "
        "VALUES (%s,%s,'policy.txt','text/plain',1,'k','indexed')",
        (doc, ws),
    )
    vec = FakeEmbeddings(1024).embed([text])[0]
    lit = "[" + ",".join(str(x) for x in vec) + "]"
    conn.execute(
        "INSERT INTO chunks (document_id,workspace_id,ordinal,text,page,char_start,char_end,token_count,embedding) "
        "VALUES (%s,%s,0,%s,1,0,%s,1,%s::vector)",
        (doc, ws, text, len(text), lit),
    )
    conn.execute(
        "INSERT INTO document_groups (document_id,workspace_id,group_id) VALUES (%s,%s,%s)",
        (doc, ws, group_id),
    )
    return str(doc)


def _msg(uid, text):
    return {
        "update_id": uid,
        "message": {
            "text": text,
            "from": {"id": uid, "username": f"u{uid}", "first_name": "U"},
            "chat": {"id": uid},
        },
    }


def test_telegram_flow():
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _seed_ws(conn, ws)
            _everyone(conn, ws)
            fin = _group(conn, ws, "Finance")
            _doc(conn, ws, "Backups are retained for thirty days.", fin)
    try:
        with psycopg.connect(DB) as conn:
            # /start from a new user -> requested, link is pending
            assert handle_update(conn, str(ws), _msg(1001, "/start")) == REQUESTED
            # a question while pending -> pending
            assert handle_update(conn, str(ws), _msg(1001, "retention?")) == PENDING
            # approve + add the link to Finance
            with conn.transaction():
                conn.execute("UPDATE telegram_links SET status='approved' WHERE telegram_user_id=1001")
                lid = conn.execute(
                    "SELECT id FROM telegram_links WHERE telegram_user_id=1001"
                ).fetchone()[0]
                conn.execute(
                    "INSERT INTO group_members (workspace_id, group_id, telegram_link_id) VALUES (%s,%s,%s)",
                    (ws, fin, lid),
                )
            reply = handle_update(conn, str(ws), _msg(1001, "What is the retention policy?"))
            assert "Based on your sources" in reply and "thirty days" in reply
            # a different, still-pending user is refused
            assert handle_update(conn, str(ws), _msg(2002, "/start")) == REQUESTED
            assert handle_update(conn, str(ws), _msg(2002, "retention?")) == PENDING
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
