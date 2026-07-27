"""A newly provisioned firm must have its Everyone group before anyone signs in.

resolve_access looks the group up on every member request, and documents are
tagged to it on upload. It IS created lazily, so the failure this prevents is not
a crash — it is a firm whose owner opens the Access page on day one, sees nothing,
and has no group to tag anything with.
"""

import os
import uuid

import psycopg
import pytest

from app.library.groups import get_everyone

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn) -> str:
    ws = uuid.uuid4()
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'boot',%s)", (ws, str(ws)))
    return str(ws)


def test_bootstrap_creates_the_everyone_group_and_is_idempotent():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
        before = conn.execute(
            "SELECT count(*) FROM groups WHERE workspace_id=%s", (ws,)
        ).fetchone()[0]

        first = get_everyone(conn, ws)
        second = get_everyone(conn, ws)

        rows = conn.execute(
            "SELECT id, name, is_default FROM groups WHERE workspace_id=%s", (ws,)
        ).fetchall()
    try:
        assert before == 0, "a fresh workspace should start with no groups"
        assert first == second, "bootstrapping twice must not mint a second group"
        assert len(rows) == 1
        assert rows[0][1] == "Everyone"
        assert rows[0][2] is True
    finally:
        with psycopg.connect(DB) as conn:
            with conn.transaction():
                conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
