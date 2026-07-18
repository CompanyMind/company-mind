import os
import uuid

import psycopg
import pytest

from app.library import groups as g

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def test_group_lifecycle():
    ws, user, doc = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _ws(conn, ws)
            conn.execute(
                "INSERT INTO users (id,email,password_hash) VALUES (%s,%s,'x')",
                (user, f"{user}@e.com"),
            )
            conn.execute(
                "INSERT INTO documents (id,workspace_id,filename,mime,bytes,storage_key,status) "
                "VALUES (%s,%s,'f.txt','text/plain',1,'k','indexed')",
                (doc, ws),
            )
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            grp = g.create_group(conn, str(ws), "Finance")
            assert grp and grp["name"] == "Finance"
            assert g.create_group(conn, str(ws), "Finance") is None  # slug conflict
            gid = grp["id"]

            assert g.rename_group(conn, str(ws), gid, "Finance Team") is True

            g.set_group_members(conn, str(ws), gid, [str(user)])
            assert g.group_member_user_ids(conn, str(ws)).get(gid) == [str(user)]

            g.set_document_groups(conn, str(ws), str(doc), [gid])
            assert g.document_group_ids(conn, str(ws), str(doc)) == [gid]

            ev = g.get_everyone(conn, str(ws))  # creates the Everyone group
            assert g.delete_group(conn, str(ws), ev) == "default"
            assert g.delete_group(conn, str(ws), gid) == "ok"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
                conn.execute("DELETE FROM users WHERE id=%s", (user,))
