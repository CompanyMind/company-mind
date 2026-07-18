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
