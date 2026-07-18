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
