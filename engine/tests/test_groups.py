import os
import uuid

import psycopg
import pytest

from app.library import groups as g

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn, ws):
    conn.execute("INSERT INTO workspaces (id,name,slug) VALUES (%s,%s,%s)", (ws, f"ws-{ws}", str(ws)))


def test_list_groups_reports_how_many_documents_each_one_opens():
    """Access answers "who can see what". Without this count it only ever
    answered the first half — a row reading "Exec-only · 1 person" told an
    owner nothing about what that person could reach."""
    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            _ws(conn, ws)
    try:
        with psycopg.connect(DB) as conn:
            conn.autocommit = True
            finance = g.create_group(conn, str(ws), "Finance")
            empty = g.create_group(conn, str(ws), "Board")
            for name in ("a.txt", "b.txt"):
                doc = conn.execute(
                    "INSERT INTO documents (workspace_id,filename,mime,bytes,storage_key,status) "
                    "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
                    (ws, name),
                ).fetchone()[0]
                conn.execute(
                    "INSERT INTO document_groups (workspace_id,document_id,group_id) "
                    "VALUES (%s,%s,%s)",
                    (ws, doc, finance["id"]),
                )

            by_name = {r["name"]: r for r in g.list_groups(conn, str(ws))}

            assert by_name["Finance"]["document_count"] == 2
            # A group that grants nothing must still be listed, showing zero —
            # "no one can reach anything through this" is itself the answer an
            # owner came for, and a vanished row would read as no group at all.
            assert by_name["Board"]["document_count"] == 0
            assert empty["name"] == "Board"
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


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
