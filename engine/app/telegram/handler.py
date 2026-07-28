import html
from dataclasses import dataclass

from .store import tg_access
from ..ask.service import answer_query
from ..db import get_conn
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


@dataclass
class Principal:
    """Who is asking, once the DB has been consulted. `reply` short-circuits:
    a pending/blocked/greeting message is answered from this alone, with no
    retrieval and no model call."""

    link_id: str
    group_ids: list[str]
    text: str
    telegram_user_id: int
    reply: str | None = None


def resolve_principal(conn, workspace_id: str, update: dict) -> Principal | None:
    """Phase 1 — DB only, no network. Upserts the link, decides whether this
    message is answerable at all, and resolves the identity's group ids.

    Split out of handle_update so the caller can release its pooled connection
    before answer_query runs: answer_query opens two connections of its own and
    makes an embedding call plus a chat call (timeout=120) in between. Holding
    one across all that is both a pool-starvation risk and a re-entrant
    acquisition — with ten connections in the pool, enough concurrent messages
    turn it into a PoolTimeout."""
    msg = update.get("message")
    if not msg or "text" not in msg:
        return None
    text = msg["text"].strip()
    tg_user = msg["from"]

    with conn.transaction():
        link_id, status = _upsert_link(conn, workspace_id, tg_user)

    p = Principal(link_id=link_id, group_ids=[], text=text, telegram_user_id=tg_user["id"])
    if text.startswith("/start"):
        p.reply = REQUESTED if status == "pending" else GREET
        return p
    if status == "pending":
        p.reply = PENDING
        return p
    if status == "blocked":
        p.reply = BLOCKED
        return p

    p.group_ids = tg_access(conn, workspace_id, link_id)
    return p


def answer_for(workspace_id: str, p: Principal) -> str:
    """Phase 2 — retrieval + answering. Takes NO connection: answer_query
    acquires its own, and this is where the model call happens."""
    if p.reply is not None:
        return p.reply

    # Approved: answer via the single ask path, scoped to exactly the groups this
    # Telegram identity can see. The service performs retrieval, answering, and the
    # audit-log write (tagged with this telegram link).
    result = answer_query(
        workspace_id,
        p.text,
        group_ids=p.group_ids,
        all_access=False,
        telegram_link_id=p.link_id,
        log_question=f"[telegram:{p.telegram_user_id}] {p.text}",
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


def handle_update(conn, workspace_id: str, update: dict) -> str | None:
    """Both phases on a caller-supplied connection. For direct/test callers;
    the worker uses handle_update_pooled, which does not hold one across the
    model call."""
    p = resolve_principal(conn, workspace_id, update)
    if p is None:
        return None
    return answer_for(workspace_id, p)


def handle_update_pooled(workspace_id: str, update: dict) -> str | None:
    """The worker's path: a short connection for the identity lookup, then the
    answer with nothing checked out."""
    with get_conn() as conn:
        p = resolve_principal(conn, workspace_id, update)
    if p is None:
        return None
    return answer_for(workspace_id, p)
