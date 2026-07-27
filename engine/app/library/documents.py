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
