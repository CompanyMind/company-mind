from ..access import document_perm_sql
from .groups import get_everyone, set_document_groups


def list_documents(
    conn,
    workspace_id: str,
    folder: str | None,
    group_ids: list[str],
    all_access: bool,
) -> list[dict]:
    """`folder` is a folder id, the literal 'unfiled', or None for every document.

    `group_ids` / `all_access` come from access.py::resolve_access and are NOT
    optional: filenames disclose what the access model exists to protect, so a
    caller that forgets them must be a hard error rather than a silent full read.
    """
    sql = (
        "SELECT d.id, d.filename, d.mime, d.bytes, d.status, d.error, d.created_at, d.folder_id "
        "FROM documents d WHERE d.workspace_id=%s"
    )
    params: list = [workspace_id]
    if not all_access:
        sql += " AND " + document_perm_sql("d.id")
        params.append(list(group_ids))
    if folder == "unfiled":
        sql += " AND d.folder_id IS NULL"
    elif folder:
        sql += " AND d.folder_id=%s"
        params.append(folder)
    sql += " ORDER BY d.created_at DESC"
    rows = conn.execute(sql, tuple(params)).fetchall()
    dg = conn.execute(
        "SELECT document_id, group_id FROM document_groups WHERE workspace_id=%s",
        (workspace_id,),
    ).fetchall()
    groups_by_doc: dict[str, list[str]] = {}
    for did, gid in dg:
        groups_by_doc.setdefault(str(did), []).append(str(gid))
    return [
        {
            "id": str(r[0]),
            "filename": r[1],
            "mime": r[2],
            "bytes": r[3],
            "status": r[4],
            "error": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "folder_id": str(r[7]) if r[7] else None,
            "group_ids": groups_by_doc.get(str(r[0]), []),
        }
        for r in rows
    ]


def get_document(
    conn,
    workspace_id: str,
    document_id: str,
    group_ids: list[str],
    all_access: bool,
) -> dict | None:
    """One document, WITH its storage key, subject to the same predicate as
    list_documents. Returns None when it does not exist *or* the caller may not
    see it — the two are deliberately indistinguishable, since a 403 on an id
    you guessed still confirms the document exists.

    This is what backs download, so the access check is not cosmetic: without
    it, an id copied out of a colleague's citation link would hand over the
    whole file, bypassing the group the document is tagged with.
    """
    sql = (
        "SELECT d.id, d.filename, d.mime, d.bytes, d.status, d.error, d.created_at, "
        "d.folder_id, d.storage_key FROM documents d WHERE d.workspace_id=%s AND d.id=%s"
    )
    params: list = [workspace_id, document_id]
    if not all_access:
        sql += " AND " + document_perm_sql("d.id")
        params.append(list(group_ids))
    row = conn.execute(sql, tuple(params)).fetchone()
    if row is None:
        return None
    gids = [
        str(g[0])
        for g in conn.execute(
            "SELECT group_id FROM document_groups WHERE document_id=%s", (document_id,)
        ).fetchall()
    ]
    return {
        "id": str(row[0]),
        "filename": row[1],
        "mime": row[2],
        "bytes": row[3],
        "status": row[4],
        "error": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
        "folder_id": str(row[7]) if row[7] else None,
        "storage_key": row[8],
        "group_ids": gids,
    }


def delete_document(conn, workspace_id: str, document_id: str) -> str | None:
    """Remove a document and everything derived from it. Returns its storage key
    so the caller can drop the stored file too, or None if there was no such row
    in this workspace.

    One statement is enough: chunks, ingestion_jobs, document_groups and the
    graph_* tables all cascade from documents. Citations deliberately do NOT —
    they carry `ON DELETE SET NULL` and a frozen filename/page/snippet, so an
    answer that was already given keeps its evidence and simply stops being
    clickable. Rewriting history to make a deleted document look like it was
    never cited would be the wrong repair for an audit surface.

    No access predicate here, by design: deletion is owner-only, gated at the
    web route (lib/control-plane-gates.test.ts), and an owner has all_access.
    The workspace_id in the WHERE clause is what stops a cross-firm delete.
    """
    row = conn.execute(
        "DELETE FROM documents WHERE workspace_id=%s AND id=%s RETURNING storage_key",
        (workspace_id, document_id),
    ).fetchone()
    return row[0] if row else None


def create_document(
    conn, workspace_id: str, filename: str, mime: str, bytes_: int, storage_key: str
) -> dict:
    """Create the document + its queued ingestion job, and default it to the
    Everyone group so a new upload is never accidentally hidden."""
    with conn.transaction():
        row = conn.execute(
            "INSERT INTO documents (workspace_id, filename, mime, bytes, storage_key, status) "
            "VALUES (%s,%s,%s,%s,%s,'uploaded') RETURNING id, created_at",
            (workspace_id, filename, mime, bytes_, storage_key),
        ).fetchone()
        doc_id, created_at = str(row[0]), row[1]
        conn.execute(
            "INSERT INTO ingestion_jobs (document_id, workspace_id, status) VALUES (%s,%s,'queued')",
            (doc_id, workspace_id),
        )
    ev = get_everyone(conn, workspace_id)
    set_document_groups(conn, workspace_id, doc_id, [ev])
    return {
        "id": doc_id,
        "filename": filename,
        "mime": mime,
        "bytes": bytes_,
        "status": "uploaded",
        "error": None,
        "created_at": created_at.isoformat() if created_at else None,
        "folder_id": None,
        "group_ids": [ev],
    }
