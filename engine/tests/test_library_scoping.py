"""The library listings must obey the same access rule as retrieval.

Before this, `list_documents` and `list_folders` took only a workspace, so any
member browsing Sources saw every filename in the firm — including documents
they could never open. Filenames are not neutral metadata in this product:
"redundancy-list.xlsx" discloses the thing the access model exists to protect.

Every test here is deliberately non-vacuous: the member always CAN see one
document, so "returns nothing at all" can never be mistaken for "correctly
scoped".
"""

import os
import uuid

import psycopg
import pytest

from app.access import resolve_access
from app.library import documents as lib_docs
from app.library import folders as lib_folders

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn) -> str:
    ws = uuid.uuid4()
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'scope',%s)", (ws, str(ws)))
    return str(ws)


def _user(conn) -> str:
    row = conn.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s,'x') RETURNING id",
        (f"{uuid.uuid4()}@scope.test",),
    ).fetchone()
    return str(row[0])


def _group(conn, ws: str, name: str, is_default: bool = False) -> str:
    row = conn.execute(
        "INSERT INTO groups (workspace_id, name, slug, is_default) VALUES (%s,%s,%s,%s) "
        "RETURNING id",
        (ws, name, name.lower(), is_default),
    ).fetchone()
    return str(row[0])


def _doc(conn, ws: str, name: str, group_id: str) -> str:
    row = conn.execute(
        "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
        (ws, name),
    ).fetchone()
    doc_id = str(row[0])
    conn.execute(
        "INSERT INTO document_groups (workspace_id, document_id, group_id) VALUES (%s,%s,%s)",
        (ws, doc_id, group_id),
    )
    return doc_id


def _join(conn, ws: str, group_id: str, user_id: str) -> None:
    conn.execute(
        "INSERT INTO group_members (workspace_id, group_id, user_id) VALUES (%s,%s,%s)",
        (ws, group_id, user_id),
    )


def _cleanup(ws: str, user_ids: list[str]) -> None:
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))
            for u in user_ids:
                conn.execute("DELETE FROM users WHERE id=%s", (u,))


def test_member_document_list_excludes_documents_outside_their_groups():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            member = _user(conn)
            hr = _group(conn, ws, "HR")
            execs = _group(conn, ws, "Exec")
            _doc(conn, ws, "handbook.pdf", hr)
            _doc(conn, ws, "redundancy-list.xlsx", execs)
            _join(conn, ws, hr, member)
        gids, all_access = resolve_access(conn, ws, member, "member")
        rows = lib_docs.list_documents(conn, ws, None, gids, all_access)
    try:
        names = {r["filename"] for r in rows}
        # Non-vacuous: the member DOES see their own group's document...
        assert "handbook.pdf" in names
        # ...and never the one they cannot open.
        assert "redundancy-list.xlsx" not in names
        assert len(rows) == 1
    finally:
        _cleanup(ws, [member])


def test_owner_document_list_sees_every_document():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            owner = _user(conn)
            _doc(conn, ws, "handbook.pdf", _group(conn, ws, "HR"))
            _doc(conn, ws, "redundancy-list.xlsx", _group(conn, ws, "Exec"))
        gids, all_access = resolve_access(conn, ws, owner, "owner")
        rows = lib_docs.list_documents(conn, ws, None, gids, all_access)
    try:
        assert all_access is True
        assert len(rows) == 2
    finally:
        _cleanup(ws, [owner])


def test_folder_counts_exclude_invisible_documents_and_empty_folders_are_hidden():
    """A folder holding only documents the member cannot open must not render at
    all. An empty "Board Minutes" folder still discloses that board minutes exist."""
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            member = _user(conn)
            hr = _group(conn, ws, "HR")
            execs = _group(conn, ws, "Exec")
            _join(conn, ws, hr, member)
            visible = _doc(conn, ws, "handbook.pdf", hr)
            hidden = _doc(conn, ws, "board-minutes.pdf", execs)
            mixed = _doc(conn, ws, "policy.pdf", execs)
        f_people = lib_folders.create_folder(conn, ws, "People")
        f_board = lib_folders.create_folder(conn, ws, "Board Minutes")
        lib_folders.set_document_folder(conn, ws, visible, f_people["id"])
        lib_folders.set_document_folder(conn, ws, mixed, f_people["id"])
        lib_folders.set_document_folder(conn, ws, hidden, f_board["id"])

        gids, all_access = resolve_access(conn, ws, member, "member")
        out = lib_folders.list_folders(conn, ws, gids, all_access)
        owner_out = lib_folders.list_folders(conn, ws, [], True)
    try:
        names = [f["name"] for f in out["folders"]]
        assert "People" in names, "the member must still see their own folder"
        assert "Board Minutes" not in names, "a wholly invisible folder leaks its topic"
        people = next(f for f in out["folders"] if f["name"] == "People")
        assert people["document_count"] == 1, "the count must exclude the invisible document"
        # The owner is unaffected — both folders, both counts.
        assert sorted(f["name"] for f in owner_out["folders"]) == ["Board Minutes", "People"]
        assert next(f for f in owner_out["folders"] if f["name"] == "People")["document_count"] == 2
    finally:
        _cleanup(ws, [member])


def test_unfiled_count_excludes_invisible_documents():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            member = _user(conn)
            hr = _group(conn, ws, "HR")
            _join(conn, ws, hr, member)
            _doc(conn, ws, "mine.pdf", hr)
            _doc(conn, ws, "theirs.pdf", _group(conn, ws, "Exec"))
        gids, all_access = resolve_access(conn, ws, member, "member")
        out = lib_folders.list_folders(conn, ws, gids, all_access)
        owner_out = lib_folders.list_folders(conn, ws, [], True)
    try:
        assert out["unfiled_count"] == 1
        assert owner_out["unfiled_count"] == 2
    finally:
        _cleanup(ws, [member])


def test_folder_filtered_document_list_is_also_scoped():
    """Scoping the top-level list but not the per-folder list would leave the
    leak one click away."""
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            member = _user(conn)
            hr = _group(conn, ws, "HR")
            _join(conn, ws, hr, member)
            visible = _doc(conn, ws, "handbook.pdf", hr)
            hidden = _doc(conn, ws, "salaries.xlsx", _group(conn, ws, "Exec"))
        folder = lib_folders.create_folder(conn, ws, "Shared")
        lib_folders.set_document_folder(conn, ws, visible, folder["id"])
        lib_folders.set_document_folder(conn, ws, hidden, folder["id"])
        gids, all_access = resolve_access(conn, ws, member, "member")
        rows = lib_docs.list_documents(conn, ws, folder["id"], gids, all_access)
    try:
        names = {r["filename"] for r in rows}
        assert names == {"handbook.pdf"}
    finally:
        _cleanup(ws, [member])
