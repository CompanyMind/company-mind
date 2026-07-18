import re


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "group"


def list_groups(conn, workspace_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, name, is_default FROM groups WHERE workspace_id=%s ORDER BY is_default DESC, name",
        (workspace_id,),
    ).fetchall()
    return [{"id": str(r[0]), "name": r[1], "is_default": r[2]} for r in rows]


def group_member_user_ids(conn, workspace_id: str) -> dict[str, list[str]]:
    rows = conn.execute(
        "SELECT group_id, user_id FROM group_members "
        "WHERE workspace_id=%s AND user_id IS NOT NULL",
        (workspace_id,),
    ).fetchall()
    out: dict[str, list[str]] = {}
    for gid, uid in rows:
        out.setdefault(str(gid), []).append(str(uid))
    return out


def create_group(conn, workspace_id: str, name: str) -> dict | None:
    """Create a non-default group. Returns the group, or None on slug conflict."""
    slug = _slug(name)
    with conn.transaction():
        dup = conn.execute(
            "SELECT 1 FROM groups WHERE workspace_id=%s AND slug=%s", (workspace_id, slug)
        ).fetchone()
        if dup:
            return None
        row = conn.execute(
            "INSERT INTO groups (workspace_id, name, slug, is_default) VALUES (%s,%s,%s,false) "
            "RETURNING id, name, is_default",
            (workspace_id, name, slug),
        ).fetchone()
    return {"id": str(row[0]), "name": row[1], "is_default": row[2]}


def rename_group(conn, workspace_id: str, group_id: str, name: str) -> bool:
    with conn.transaction():
        found = conn.execute(
            "SELECT 1 FROM groups WHERE id=%s AND workspace_id=%s", (group_id, workspace_id)
        ).fetchone()
        if not found:
            return False
        conn.execute(
            "UPDATE groups SET name=%s, slug=%s WHERE id=%s AND workspace_id=%s",
            (name, _slug(name), group_id, workspace_id),
        )
    return True


def delete_group(conn, workspace_id: str, group_id: str) -> str:
    """Returns 'ok', 'notfound', or 'default' (the Everyone group cannot be deleted)."""
    with conn.transaction():
        row = conn.execute(
            "SELECT is_default FROM groups WHERE id=%s AND workspace_id=%s",
            (group_id, workspace_id),
        ).fetchone()
        if not row:
            return "notfound"
        if row[0]:
            return "default"
        conn.execute("DELETE FROM groups WHERE id=%s AND workspace_id=%s", (group_id, workspace_id))
    return "ok"


def set_group_members(conn, workspace_id: str, group_id: str, user_ids: list[str]) -> None:
    """Replace a group's web-user membership. `user_ids` are already validated by the
    caller (web owns the auth-side membership check)."""
    with conn.transaction():
        conn.execute(
            "DELETE FROM group_members WHERE group_id=%s AND workspace_id=%s AND user_id IS NOT NULL",
            (group_id, workspace_id),
        )
        for uid in user_ids:
            conn.execute(
                "INSERT INTO group_members (workspace_id, group_id, user_id) VALUES (%s,%s,%s)",
                (workspace_id, group_id, uid),
            )


def document_group_ids(conn, workspace_id: str, document_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT group_id FROM document_groups WHERE document_id=%s AND workspace_id=%s",
        (document_id, workspace_id),
    ).fetchall()
    return [str(r[0]) for r in rows]


def set_document_groups(conn, workspace_id: str, document_id: str, group_ids: list[str]) -> None:
    with conn.transaction():
        conn.execute(
            "DELETE FROM document_groups WHERE document_id=%s AND workspace_id=%s",
            (document_id, workspace_id),
        )
        # Only groups that actually belong to this workspace.
        valid = conn.execute(
            "SELECT id FROM groups WHERE workspace_id=%s AND id = ANY(%s::uuid[])",
            (workspace_id, group_ids),
        ).fetchall()
        for (gid,) in valid:
            conn.execute(
                "INSERT INTO document_groups (document_id, workspace_id, group_id) VALUES (%s,%s,%s) "
                "ON CONFLICT DO NOTHING",
                (document_id, workspace_id, gid),
            )


def get_everyone(conn, workspace_id: str) -> str:
    """The default 'Everyone' group id, creating it if absent."""
    row = conn.execute(
        "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (workspace_id,)
    ).fetchone()
    if row:
        return str(row[0])
    with conn.transaction():
        row = conn.execute(
            "INSERT INTO groups (workspace_id, name, slug, is_default) "
            "VALUES (%s,'Everyone','everyone',true) RETURNING id",
            (workspace_id,),
        ).fetchone()
    return str(row[0])
