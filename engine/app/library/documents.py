from .groups import get_everyone, set_document_groups


def list_documents(conn, workspace_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, filename, mime, bytes, status, error, created_at FROM documents "
        "WHERE workspace_id=%s ORDER BY created_at DESC",
        (workspace_id,),
    ).fetchall()
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
        "group_ids": [ev],
    }
