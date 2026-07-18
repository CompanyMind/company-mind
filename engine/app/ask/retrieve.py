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


def retrieve(workspace_id: str, query: str, k: int = 8) -> list[Retrieved]:
    qvec = get_provider().embed([query])[0]
    lit = "[" + ",".join(str(x) for x in qvec) + "]"
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT c.id, c.document_id, d.filename, c.page, c.char_start, c.char_end, c.text, "
            "       1 - (c.embedding <=> %s::vector) AS score "
            "FROM chunks c JOIN documents d ON d.id = c.document_id "
            "WHERE c.workspace_id = %s AND c.embedding IS NOT NULL "
            "ORDER BY c.embedding <=> %s::vector "
            "LIMIT %s",
            (lit, workspace_id, lit, k),
        ).fetchall()
    finally:
        conn.close()
    return [
        Retrieved(str(r[0]), str(r[1]), r[2], r[3], r[4], r[5], r[6], float(r[7]))
        for r in rows
    ]
