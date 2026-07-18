from dataclasses import dataclass

from ..db import get_conn
from ..ingest.embed import get_provider


@dataclass
class Retrieved:
    chunk_id: str
    document_id: str
    filename: str
    page: int | None
    char_start: int | None
    char_end: int | None
    text: str
    score: float


def retrieve(
    workspace_id: str,
    query: str,
    k: int = 8,
    group_ids: list[str] | None = None,
    all_access: bool = False,
) -> list[Retrieved]:
    qvec = get_provider().embed([query])[0]
    lit = "[" + ",".join(str(x) for x in qvec) + "]"
    gids = group_ids or []
    conn = get_conn()
    try:
        # Permission filter lives here, in one predicate: unless the caller has
        # all_access (owner), a chunk is only visible if its document is tagged
        # with one of the caller's groups.
        rows = conn.execute(
            "SELECT c.id, c.document_id, d.filename, c.page, c.char_start, c.char_end, c.text, "
            "       1 - (c.embedding <=> %s::vector) AS score "
            "FROM chunks c JOIN documents d ON d.id = c.document_id "
            "WHERE c.workspace_id = %s AND c.embedding IS NOT NULL "
            "  AND ( %s OR EXISTS (SELECT 1 FROM document_groups dg "
            "                      WHERE dg.document_id = c.document_id "
            "                        AND dg.group_id = ANY(%s::uuid[])) ) "
            "ORDER BY c.embedding <=> %s::vector "
            "LIMIT %s",
            (lit, workspace_id, all_access, gids, lit, k),
        ).fetchall()
    finally:
        conn.close()
    return [
        Retrieved(str(r[0]), str(r[1]), r[2], r[3], r[4], r[5], r[6], float(r[7]))
        for r in rows
    ]
