def document_perm_sql(doc_expr: str) -> str:
    """The ONE document-level permission predicate, reused by every surface that
    reads documents: retrieval, the library listing, folder counts.

    `doc_expr` is the caller's SQL expression for the document id — `d.id` when
    selecting from documents, `c.document_id` when selecting from chunks. It is
    always a literal written in this repo, never user input.

    Takes one parameter: the caller's group ids. Callers append it only when
    all_access is False; an owner needs no predicate at all."""
    return (
        "EXISTS (SELECT 1 FROM document_groups dg "
        f"WHERE dg.document_id = {doc_expr} AND dg.group_id = ANY(%s::uuid[]))"
    )


def resolve_access(conn, workspace_id: str, user_id: str, role: str) -> tuple[list[str], bool]:
    """The single access rule (moved out of the web app). Owners bypass the group
    filter (all_access); everyone else is scoped to the Everyone group plus any
    groups they belong to. Returns (group_ids, all_access)."""
    if role == "owner":
        return [], True
    ev = conn.execute(
        "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (workspace_id,)
    ).fetchone()
    rows = conn.execute(
        "SELECT group_id FROM group_members WHERE workspace_id=%s AND user_id=%s",
        (workspace_id, user_id),
    ).fetchall()
    ids: set[str] = set()
    if ev:
        ids.add(str(ev[0]))
    ids |= {str(r[0]) for r in rows}
    return list(ids), False
