import os
import uuid

import psycopg
import pytest

from app.telegram import store as tg

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def test_link_admin_and_status():
    ws, link, gid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _ws(conn, ws)
            conn.execute(
                "INSERT INTO groups (id,workspace_id,name,slug,is_default) "
                "VALUES (%s,%s,'Finance',%s,false)",
                (gid, ws, f"fin-{gid}"),
            )
            conn.execute(
                "INSERT INTO telegram_links (id,workspace_id,telegram_user_id,telegram_username,display_name,status) "
                "VALUES (%s,%s,555,'u','U','pending')",
                (link, ws),
            )
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            assert tg.status(conn, str(ws)) == {"connected": False, "username": None}
            assert tg.set_link_status(conn, str(ws), str(link), "approve") == "ok"
            assert tg.set_link_status(conn, str(ws), str(uuid.uuid4()), "approve") == "notfound"
            assert tg.set_link_status(conn, str(ws), str(link), "bogus") == "unknown"
            tg.set_link_groups(conn, str(ws), str(link), [str(gid)])
            links = tg.list_links(conn, str(ws))
            assert len(links) == 1
            assert links[0]["status"] == "approved"
            assert links[0]["group_ids"] == [str(gid)]
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
