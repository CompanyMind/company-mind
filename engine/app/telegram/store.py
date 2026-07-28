from .crypto import encrypt, decrypt
from ..db import get_conn


def connect_bot(workspace_id: str, token: str, username: str) -> None:
    with get_conn() as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO telegram_bots (workspace_id, bot_token_encrypted, bot_username) "
                "VALUES (%s,%s,%s) ON CONFLICT (workspace_id) DO UPDATE "
                "SET bot_token_encrypted=EXCLUDED.bot_token_encrypted, bot_username=EXCLUDED.bot_username",
                (workspace_id, encrypt(token), username),
            )


def disconnect_bot(workspace_id: str) -> None:
    with get_conn() as conn:
        with conn.transaction():
            conn.execute("DELETE FROM telegram_bots WHERE workspace_id=%s", (workspace_id,))


def connected_bots(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT workspace_id, bot_token_encrypted, bot_username, last_update_id FROM telegram_bots"
    ).fetchall()
    return [
        {"workspace_id": str(r[0]), "token": decrypt(r[1]), "username": r[2], "offset": r[3]}
        for r in rows
    ]


def status(conn, workspace_id: str) -> dict:
    row = conn.execute(
        "SELECT bot_username FROM telegram_bots WHERE workspace_id=%s", (workspace_id,)
    ).fetchone()
    return {"connected": bool(row), "username": row[0] if row else None}


def list_links(conn, workspace_id: str) -> list[dict]:
    links = conn.execute(
        "SELECT id, telegram_username, display_name, status FROM telegram_links "
        "WHERE workspace_id=%s ORDER BY created_at DESC",
        (workspace_id,),
    ).fetchall()
    gm = conn.execute(
        "SELECT telegram_link_id, group_id FROM group_members "
        "WHERE workspace_id=%s AND telegram_link_id IS NOT NULL",
        (workspace_id,),
    ).fetchall()
    groups_by_link: dict[str, list[str]] = {}
    for lid, gid in gm:
        groups_by_link.setdefault(str(lid), []).append(str(gid))
    return [
        {
            "id": str(link_row[0]),
            "telegram_username": link_row[1],
            "display_name": link_row[2],
            "status": link_row[3],
            "group_ids": groups_by_link.get(str(link_row[0]), []),
        }
        for link_row in links
    ]


def set_link_status(conn, workspace_id: str, link_id: str, action: str) -> str:
    """Returns 'ok', 'notfound', or 'unknown' (bad action).

    The existence check and the write are ONE transaction, and both UPDATEs
    carry workspace_id. Previously the check ran outside the transaction and the
    UPDATEs matched on id alone — so the workspace scoping lived entirely in a
    SELECT taken a moment earlier, which is a scoping story rather than a
    scoping mechanism. Approving a Telegram identity grants document access, so
    this is a control-plane write and the predicate belongs on the write."""
    if action not in ("approve", "block"):
        return "unknown"
    with conn.transaction():
        found = conn.execute(
            "SELECT 1 FROM telegram_links WHERE id=%s AND workspace_id=%s",
            (link_id, workspace_id),
        ).fetchone()
        if not found:
            return "notfound"
        if action == "approve":
            conn.execute(
                "UPDATE telegram_links SET status='approved', approved_at=now() "
                "WHERE id=%s AND workspace_id=%s",
                (link_id, workspace_id),
            )
        else:
            conn.execute(
                "UPDATE telegram_links SET status='blocked' WHERE id=%s AND workspace_id=%s",
                (link_id, workspace_id),
            )
    return "ok"


def set_link_groups(conn, workspace_id: str, link_id: str, group_ids: list[str]) -> None:
    with conn.transaction():
        conn.execute(
            "DELETE FROM group_members WHERE workspace_id=%s AND telegram_link_id=%s",
            (workspace_id, link_id),
        )
        valid = conn.execute(
            "SELECT id FROM groups WHERE workspace_id=%s AND id = ANY(%s::uuid[])",
            (workspace_id, group_ids),
        ).fetchall()
        for (gid,) in valid:
            conn.execute(
                "INSERT INTO group_members (workspace_id, group_id, telegram_link_id) "
                "VALUES (%s,%s,%s)",
                (workspace_id, gid, link_id),
            )


def tg_access(conn, workspace_id: str, link_id: str) -> list[str]:
    """Group ids visible to a Telegram identity: the Everyone group + assigned groups."""
    ev = conn.execute(
        "SELECT id FROM groups WHERE workspace_id=%s AND is_default=true", (workspace_id,)
    ).fetchone()
    rows = conn.execute(
        "SELECT group_id FROM group_members WHERE workspace_id=%s AND telegram_link_id=%s",
        (workspace_id, link_id),
    ).fetchall()
    ids = {str(ev[0])} if ev else set()
    ids |= {str(r[0]) for r in rows}
    return list(ids)
