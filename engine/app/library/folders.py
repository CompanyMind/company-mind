"""Folder CRUD and document assignment.

Folders are NAVIGATION. They are not access control: who may see a document is
decided solely by document_groups x group_members (see app/access.py). Nothing in
this module is consulted when computing visibility, and nothing here may start
being consulted for it.

list_folders applies that access rule when REPORTING folders — filtering what a
caller is shown, never deciding what they may retrieve. The distinction matters:
moving a document between folders still cannot change anyone's access.
"""

from ..access import document_perm_sql


def list_folders(conn, workspace_id: str, group_ids: list[str], all_access: bool) -> dict:
    """Folder names and per-folder counts are disclosure too: an "Executive Pay"
    folder showing 12 documents tells a member exactly what exists and how much
    of it, even though every one of those documents is unopenable to them.

    So the count is over VISIBLE documents only, and a folder with no visible
    documents is omitted entirely for a non-owner rather than rendered as empty.
    `group_ids` / `all_access` come from access.py::resolve_access; both required,
    for the same reason as list_documents."""
    # The predicate goes in the JOIN condition, not the WHERE clause: in the
    # WHERE it would drop the folder row itself instead of just not counting the
    # document, which breaks the owner's view of an empty folder.
    join_perm = " AND " + document_perm_sql("d.id") if not all_access else ""
    params: list = []
    if not all_access:
        params.append(list(group_ids))
    params.append(workspace_id)
    rows = conn.execute(
        "SELECT f.id, f.name, f.origin, f.reviewed, f.keywords, count(d.id) "
        "FROM folders f "
        "LEFT JOIN documents d ON d.folder_id = f.id AND d.workspace_id = f.workspace_id"
        + join_perm
        + " WHERE f.workspace_id=%s "
        "GROUP BY f.id, f.name, f.origin, f.reviewed, f.keywords "
        "ORDER BY f.name",
        tuple(params),
    ).fetchall()
    unfiled_sql = "SELECT count(*) FROM documents d WHERE d.workspace_id=%s AND d.folder_id IS NULL"
    unfiled_params: list = [workspace_id]
    if not all_access:
        unfiled_sql += " AND " + document_perm_sql("d.id")
        unfiled_params.append(list(group_ids))
    unfiled = conn.execute(unfiled_sql, tuple(unfiled_params)).fetchone()[0]
    return {
        "folders": [
            {
                "id": str(r[0]),
                "name": r[1],
                "origin": r[2],
                "reviewed": bool(r[3]),
                "keywords": list(r[4] or []),
                "document_count": r[5],
            }
            for r in rows
            # An owner keeps their empty folders; a member never learns they exist.
            if all_access or r[5] > 0
        ],
        "unfiled_count": unfiled,
    }


def create_folder(
    conn, workspace_id: str, name: str, origin: str = "manual", keywords: list[str] | None = None
) -> dict | None:
    """Create a folder. Returns None when the name is already taken (case-insensitive)."""
    with conn.transaction():
        dup = conn.execute(
            "SELECT 1 FROM folders WHERE workspace_id=%s AND lower(name)=lower(%s)",
            (workspace_id, name),
        ).fetchone()
        if dup:
            return None
        row = conn.execute(
            "INSERT INTO folders (workspace_id, name, origin, reviewed, keywords) "
            "VALUES (%s,%s,%s,false,%s) RETURNING id, name, origin, reviewed, keywords",
            (workspace_id, name, origin, keywords),
        ).fetchone()
    return {
        "id": str(row[0]),
        "name": row[1],
        "origin": row[2],
        "reviewed": bool(row[3]),
        "keywords": list(row[4] or []),
        "document_count": 0,
    }


def rename_folder(conn, workspace_id: str, folder_id: str, name: str) -> str:
    """'ok' | 'notfound' | 'conflict'. Renaming counts as review, so an AI folder
    stops rendering its 'suggested' chip once the user has named it."""
    with conn.transaction():
        found = conn.execute(
            "SELECT 1 FROM folders WHERE id=%s AND workspace_id=%s", (folder_id, workspace_id)
        ).fetchone()
        if not found:
            return "notfound"
        dup = conn.execute(
            "SELECT 1 FROM folders WHERE workspace_id=%s AND lower(name)=lower(%s) AND id<>%s",
            (workspace_id, name, folder_id),
        ).fetchone()
        if dup:
            return "conflict"
        conn.execute(
            "UPDATE folders SET name=%s, reviewed=true WHERE id=%s AND workspace_id=%s",
            (name, folder_id, workspace_id),
        )
    return "ok"


def delete_folder(conn, workspace_id: str, folder_id: str) -> bool:
    """Documents in the folder become unfiled — the FK is ON DELETE SET NULL.
    Deleting a folder never deletes a document."""
    with conn.transaction():
        cur = conn.execute(
            "DELETE FROM folders WHERE id=%s AND workspace_id=%s", (folder_id, workspace_id)
        )
    return cur.rowcount > 0


def set_document_folder(
    conn, workspace_id: str, document_id: str, folder_id: str | None
) -> bool:
    """Assign (or clear, with folder_id=None). False when the document or the
    target folder does not belong to this workspace."""
    with conn.transaction():
        doc = conn.execute(
            "SELECT 1 FROM documents WHERE id=%s AND workspace_id=%s", (document_id, workspace_id)
        ).fetchone()
        if not doc:
            return False
        if folder_id is not None:
            target = conn.execute(
                "SELECT 1 FROM folders WHERE id=%s AND workspace_id=%s", (folder_id, workspace_id)
            ).fetchone()
            if not target:
                return False
        conn.execute(
            "UPDATE documents SET folder_id=%s WHERE id=%s AND workspace_id=%s",
            (folder_id, document_id, workspace_id),
        )
    return True
