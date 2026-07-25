"""Starter questions for the first-run panel.

Built from the caller's OWN folders, scoped by the same access rule the ask path
uses. A suggested question is a disclosure: offering "What is the Band 4 salary
range?" to someone who cannot open the HR file leaks both that the file exists
and what it is about.
"""

from ..access import resolve_access
from ..ask.answer import get_chat_call

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


def suggest_questions(
    conn, workspace_id: str, user_id: str, role: str, limit: int = 3
) -> list[str]:
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
    if not rows:
        return []

    call = get_chat_call()
    out: list[str] = []
    for name, keywords, _count in rows:
        kws = list(keywords or [])
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
