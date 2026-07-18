from .store import tg_access
from ..ask.retrieve import retrieve
from ..ask.answer import answer_question

REQUESTED = "Access requested. An admin will approve you shortly."
PENDING = "Your access is still pending approval."
BLOCKED = "Your access has been blocked."
GREET = "You're connected. Ask me anything about your team's knowledge."


def _upsert_link(conn, workspace_id, tg_user) -> tuple[str, str]:
    row = conn.execute(
        "SELECT id, status FROM telegram_links WHERE workspace_id=%s AND telegram_user_id=%s",
        (workspace_id, tg_user["id"]),
    ).fetchone()
    if row:
        return str(row[0]), row[1]
    r = conn.execute(
        "INSERT INTO telegram_links (workspace_id, telegram_user_id, telegram_username, display_name, status) "
        "VALUES (%s,%s,%s,%s,'pending') RETURNING id",
        (workspace_id, tg_user["id"], tg_user.get("username"), tg_user.get("first_name")),
    ).fetchone()
    return str(r[0]), "pending"


def handle_update(conn, workspace_id: str, update: dict) -> str | None:
    """Pure logic + DB (no network). Returns the reply text, or None to ignore."""
    msg = update.get("message")
    if not msg or "text" not in msg:
        return None
    text = msg["text"].strip()
    tg_user = msg["from"]

    with conn.transaction():
        link_id, status = _upsert_link(conn, workspace_id, tg_user)

    if text.startswith("/start"):
        return REQUESTED if status == "pending" else GREET
    if status == "pending":
        return PENDING
    if status == "blocked":
        return BLOCKED

    # Approved: answer, scoped to exactly the groups this Telegram identity can see.
    group_ids = tg_access(conn, workspace_id, link_id)
    retrieved = retrieve(workspace_id, text, group_ids=group_ids, all_access=False)
    result = answer_question(text, retrieved)

    with conn.transaction():
        conn.execute(
            "INSERT INTO query_log (workspace_id, user_id, question, retrieved_chunk_ids, model) "
            "SELECT %s, m.user_id, %s, %s, %s FROM memberships m "
            "WHERE m.workspace_id=%s AND m.role='owner' LIMIT 1",
            (
                workspace_id,
                f"[telegram:{tg_user['id']}] {text}",
                [r.chunk_id for r in retrieved],
                "fake-telegram",
                workspace_id,
            ),
        )

    cites = " ".join(f"[{c.marker}] {c.filename}" for c in result.citations)
    return result.answer + (f"\n\nSources: {cites}" if cites else "")
