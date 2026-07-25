import os
import uuid

import psycopg
import pytest

from app.library import folders as lib

DB = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="needs DATABASE_URL")


def _ws(conn) -> str:
    ws = uuid.uuid4()
    conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'f',%s)", (ws, str(ws)))
    return str(ws)


def _doc(conn, ws: str, name: str = "d.txt") -> str:
    row = conn.execute(
        "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
        "VALUES (%s,%s,'text/plain',1,'k','indexed') RETURNING id",
        (ws, name),
    ).fetchone()
    return str(row[0])


def _cleanup(ws: str) -> None:
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("DELETE FROM workspaces WHERE id=%s", (ws,))


def test_create_list_and_count():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            d1, d2 = _doc(conn, ws, "a.txt"), _doc(conn, ws, "b.txt")
        f = lib.create_folder(conn, ws, "Finance")
        assert f is not None
        assert lib.set_document_folder(conn, ws, d1, f["id"]) is True
        out = lib.list_folders(conn, ws)
    try:
        assert [x["name"] for x in out["folders"]] == ["Finance"]
        assert out["folders"][0]["document_count"] == 1
        assert out["unfiled_count"] == 1
        assert d2  # the second document stays unfiled
    finally:
        _cleanup(ws)


def test_duplicate_name_is_rejected_case_insensitively():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
        assert lib.create_folder(conn, ws, "Finance") is not None
        assert lib.create_folder(conn, ws, "finance") is None
    _cleanup(ws)


def test_deleting_a_folder_unfiles_its_documents_and_never_deletes_them():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
            d = _doc(conn, ws)
        f = lib.create_folder(conn, ws, "Temp")
        lib.set_document_folder(conn, ws, d, f["id"])
        assert lib.delete_folder(conn, ws, f["id"]) is True
        row = conn.execute("SELECT folder_id FROM documents WHERE id=%s", (d,)).fetchone()
    try:
        assert row is not None, "the document was deleted with its folder"
        assert row[0] is None, "the document should be unfiled, not dangling"
    finally:
        _cleanup(ws)


def test_folder_from_another_workspace_is_rejected():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws_a, ws_b = _ws(conn), _ws(conn)
            d = _doc(conn, ws_a)
        other = lib.create_folder(conn, ws_b, "Elsewhere")
        assert lib.set_document_folder(conn, ws_a, d, other["id"]) is False
        row = conn.execute("SELECT folder_id FROM documents WHERE id=%s", (d,)).fetchone()
    assert row[0] is None
    _cleanup(ws_a)
    _cleanup(ws_b)


def test_rename_reports_conflict_and_marks_reviewed():
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            ws = _ws(conn)
        a = lib.create_folder(conn, ws, "Alpha", origin="ai")
        lib.create_folder(conn, ws, "Beta")
        assert lib.rename_folder(conn, ws, a["id"], "Beta") == "conflict"
        assert lib.rename_folder(conn, ws, a["id"], "Gamma") == "ok"
        assert lib.rename_folder(conn, ws, str(uuid.uuid4()), "X") == "notfound"
        out = lib.list_folders(conn, ws)
    try:
        gamma = [f for f in out["folders"] if f["name"] == "Gamma"][0]
        assert gamma["reviewed"] is True, "renaming is a review — the suggested chip must clear"
    finally:
        _cleanup(ws)


def test_moving_a_document_between_folders_does_not_change_visibility():
    """Folders are navigation. Access is document_groups x group_members and
    nothing else. If a folder move ever changes what a principal can retrieve,
    that is a security defect, not a feature."""
    from app.ask.retrieve import retrieve
    from app.ingest.embed import FakeEmbeddings

    ws = uuid.uuid4()
    with psycopg.connect(DB) as conn:
        with conn.transaction():
            conn.execute("INSERT INTO workspaces (id, name, slug) VALUES (%s,'sec',%s)", (ws, str(ws)))
            gid = uuid.uuid4()
            conn.execute(
                "INSERT INTO groups (id, workspace_id, name, slug, is_default) "
                "VALUES (%s,%s,'Finance',%s,false)",
                (gid, ws, f"fin-{gid}"),
            )
            doc = conn.execute(
                "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
                "VALUES (%s,'policy.txt','text/plain',1,'k','indexed') RETURNING id",
                (ws,),
            ).fetchone()[0]
            conn.execute(
                "INSERT INTO document_groups (document_id, workspace_id, group_id) VALUES (%s,%s,%s)",
                (doc, ws, gid),
            )
            vec = FakeEmbeddings(1024).embed(["retention is seven years"])[0]
            lit = "[" + ",".join(str(x) for x in vec) + "]"
            conn.execute(
                "INSERT INTO chunks (document_id, workspace_id, ordinal, text, embedding) "
                "VALUES (%s,%s,0,'retention is seven years',%s::vector)",
                (doc, ws, lit),
            )
    try:
        before_member, _ = retrieve(str(ws), "retention", k=8, group_ids=[str(gid)], all_access=False)
        before_outsider, _ = retrieve(str(ws), "retention", k=8, group_ids=[], all_access=False)

        with psycopg.connect(DB) as conn:
            f = lib.create_folder(conn, str(ws), "Payroll")
            assert lib.set_document_folder(conn, str(ws), str(doc), f["id"]) is True

        after_member, _ = retrieve(str(ws), "retention", k=8, group_ids=[str(gid)], all_access=False)
        after_outsider, _ = retrieve(str(ws), "retention", k=8, group_ids=[], all_access=False)

        assert [r.chunk_id for r in before_member] == [r.chunk_id for r in after_member]
        assert [r.chunk_id for r in before_outsider] == [r.chunk_id for r in after_outsider]
        assert len(after_member) == 1, "the group member must still see it"
        assert after_outsider == [], "filing a document must not expose it to anyone new"
    finally:
        _cleanup(str(ws))
