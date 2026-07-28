"""Starter questions for the first-run panel.

Built from the caller's OWN folders, scoped by the same access rule the ask path
uses. A suggested question is a disclosure: offering "What is the Band 4 salary
range?" to someone who cannot open the HR file leaks both that the file exists
and what it is about.
"""

from ..access import resolve_access
from ..ask.answer import get_chat_call
from ..db import get_conn

_PROMPT = (
    "Write one short question an employee might ask about a folder of company "
    "documents. Reply with only the question.\n"
    "Folder: {name}\n"
    "Keywords: {keywords}\n"
)


def _fallback(name: str, keywords: list[str]) -> str:
    if keywords:
        return f"What do our {name} documents say about {keywords[0]}?"
    return f"What is in our {name} documents?"


def visible_folders(
    conn, workspace_id: str, user_id: str, role: str, limit: int = 3
) -> list[tuple[str, list[str]]]:
    """Phase 1 — (name, keywords) for the folders this caller can actually see.
    Pure DB, no network."""
    group_ids, all_access = resolve_access(conn, workspace_id, user_id, role)

    # Folders ranked by how many documents this caller can actually see. Ties
    # break on name so the panel is stable between renders.
    rows = conn.execute(
        "SELECT f.name, f.keywords, count(d.id) AS visible "
        "FROM folders f JOIN documents d ON d.folder_id = f.id "
        "WHERE f.workspace_id = %s AND ( %s OR EXISTS ("
        "  SELECT 1 FROM document_groups dg "
        "  WHERE dg.document_id = d.id AND dg.group_id = ANY(%s::uuid[])) ) "
        "GROUP BY f.id, f.name, f.keywords "
        "HAVING count(d.id) > 0 "
        "ORDER BY visible DESC, f.name "
        "LIMIT %s",
        (workspace_id, all_access, group_ids, limit),
    ).fetchall()
    return [(name, list(keywords or [])) for name, keywords, _count in rows]


def render_questions(folders: list[tuple[str, list[str]]]) -> list[str]:
    """Phase 2 — one chat call per folder. Takes NO connection: three sequential
    60s-timeout calls behind a held connection is three of ten gone for the
    duration, on a decorative surface."""
    if not folders:
        return []
    call = get_chat_call()
    out: list[str] = []
    for name, kws in folders:
        if call is None:
            out.append(_fallback(name, kws))
            continue
        try:
            raw = call(_PROMPT.format(name=name, keywords=", ".join(kws) or "(none)"))
            q = raw.strip().strip('"').splitlines()[0].strip() if raw else ""
        except Exception:  # noqa: BLE001 — a suggestion never blocks the page
            q = ""
        out.append(q[:160] or _fallback(name, kws))
    return out


def suggest_questions(
    conn, workspace_id: str, user_id: str, role: str, limit: int = 3
) -> list[str]:
    """Both phases on a caller-supplied connection. For direct/test callers; the
    API path uses suggest_questions_pooled."""
    return render_questions(visible_folders(conn, workspace_id, user_id, role, limit))


def suggest_questions_pooled(
    workspace_id: str, user_id: str, role: str, limit: int = 3
) -> list[str]:
    """The API path: read, release, then call the model."""
    with get_conn() as conn:
        folders = visible_folders(conn, workspace_id, user_id, role, limit)
    return render_questions(folders)
