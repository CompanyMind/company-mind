import html

from .store import tg_access
from ..ask.service import answer_query
from ..settings import settings

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

    # Approved: answer via the single ask path, scoped to exactly the groups this
    # Telegram identity can see. The service performs retrieval, answering, and the
    # audit-log write (tagged with this telegram link).
    group_ids = tg_access(conn, workspace_id, link_id)
    result = answer_query(
        workspace_id,
        text,
        group_ids=group_ids,
        all_access=False,
        telegram_link_id=link_id,
        log_question=f"[telegram:{tg_user['id']}] {text}",
    )

    # Reply as HTML: the answer (escaped) + a Sources footer where each citation
    # is a tappable link into the sovereign web app's source viewer. The bot
    # never sends the document itself — only a pointer to it.
    answer_html = html.escape(result.answer)
    if not result.citations:
        return answer_html
    lines = []
    for c in result.citations:
        label = f"[{c.marker}] {html.escape(c.filename)}" + (f" · p.{c.page}" if c.page else "")
        if settings.app_url:
            lines.append(f'<a href="{settings.app_url}/s/{c.chunk_id}">{label}</a>')
        else:
            lines.append(label)
    return answer_html + "\n\nSources:\n" + "\n".join(lines)
