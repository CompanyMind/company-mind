from dataclasses import dataclass

from ..access import document_perm_sql
from ..db import get_conn
from ..ingest.embed import get_provider
from ..settings import settings
from .fusion import rrf, cap_by_document
from .rerank import RerankItem, get_reranker
from .telemetry import RetrievalDebug, stage


@dataclass
class Retrieved:
    chunk_id: str
    document_id: str
    filename: str
    page: int | None
    char_start: int | None
    char_end: int | None
    text: str            # the matched span — citations/highlighting use this
    score: float
    context: str = ""    # expanded text for the answerer; defaults to `text`


def _perm_sql() -> str:
    # ONE permission predicate, reused by both retrievers AND by the library
    # listings (app/access.py::document_perm_sql). Params: (all_access, gids).
    return "( %s OR " + document_perm_sql("c.document_id") + " )"


def contextualize_query(query: str) -> str:
    # Hook for future query rewriting / expansion; identity for now.
    return query


def _dense_ids(conn, ws, qvec_lit, all_access, gids, n) -> list[str]:
    rows = conn.execute(
        "SELECT c.id FROM chunks c "
        "WHERE c.workspace_id = %s AND c.embedding IS NOT NULL AND " + _perm_sql()
        + " ORDER BY c.embedding <=> %s::vector LIMIT %s",
        (ws, all_access, gids, qvec_lit, n),
    ).fetchall()
    return [str(r[0]) for r in rows]


def _lexical_ids(conn, ws, query, all_access, gids, n) -> list[str]:
    rows = conn.execute(
        "SELECT c.id FROM chunks c "
        "WHERE c.workspace_id = %s "
        "  AND to_tsvector('english', c.text) @@ plainto_tsquery('english', %s) AND " + _perm_sql()
        + " ORDER BY ts_rank_cd(to_tsvector('english', c.text), plainto_tsquery('english', %s)) DESC "
        "LIMIT %s",
        (ws, query, all_access, gids, query, n),
    ).fetchall()
    return [str(r[0]) for r in rows]


def _fetch_meta(conn, ws, ids: list[str]) -> dict:
    rows = conn.execute(
        "SELECT c.id, c.document_id, d.filename, c.page, c.char_start, c.char_end, c.text, c.ordinal "
        "FROM chunks c JOIN documents d ON d.id = c.document_id "
        "WHERE c.workspace_id = %s AND c.id = ANY(%s::uuid[])",
        (ws, ids),
    ).fetchall()
    return {
        str(r[0]): {
            "document_id": str(r[1]),
            "filename": r[2],
            "page": r[3],
            "char_start": r[4],
            "char_end": r[5],
            "text": r[6],
            "ordinal": r[7],
        }
        for r in rows
    }


def _to_retrieved(cid: str, m: dict) -> Retrieved:
    return Retrieved(
        cid, m["document_id"], m["filename"], m["page"], m["char_start"], m["char_end"],
        m["text"], 0.0, m["text"],
    )


def _expand_neighbors(conn, ws, results: list[Retrieved], meta: dict) -> None:
    # Attach ordinal±1 text as `context` so split headings/caveats return.
    # Citations still point to the matched chunk (its `text` is unchanged).
    for r in results:
        ordinal = meta[r.chunk_id]["ordinal"]
        rows = conn.execute(
            "SELECT text FROM chunks "
            "WHERE workspace_id = %s AND document_id = %s AND ordinal BETWEEN %s AND %s "
            "ORDER BY ordinal",
            (ws, r.document_id, ordinal - 1, ordinal + 1),
        ).fetchall()
        r.context = "\n".join(row[0] for row in rows) if rows else r.text


def retrieve(
    workspace_id: str,
    query: str,
    k: int | None = None,
    group_ids: list[str] | None = None,
    all_access: bool = False,
) -> tuple[list[Retrieved], RetrievalDebug]:
    """Hybrid retrieval: dense (pgvector) + lexical (Postgres full-text), fused
    with RRF, per-document capped, reranked, then neighbor-expanded. One
    permission predicate serves both retrievers. Returns the results and a
    RetrievalDebug describing how the pipeline actually behaved.

    Three connection phases, mirroring ingest's process_document: candidate
    retrieval (phase A) and neighbor expansion (phase C) each hold a pooled
    connection only as long as they need one. Reranking (phase B) is a network
    call (LLMReranker/CrossEncoderReranker, timeout=60s) and MUST NOT hold a
    connection — the pool has ten, shared with ingest, the Telegram worker, and
    Atlas; holding one across the HTTP call would starve them under load."""
    final_k = k or settings.final_k
    gids = group_ids or []
    dbg = RetrievalDebug()

    with stage(dbg, "embed_query"):
        qvec = get_provider().embed([contextualize_query(query)])[0]
    qlit = "[" + ",".join(str(x) for x in qvec) + "]"

    # Phase A: candidate retrieval + fusion + capping. Connection released on exit.
    with get_conn() as conn:
        with stage(dbg, "dense"):
            dense = _dense_ids(conn, workspace_id, qlit, all_access, gids, settings.retrieval_n_vec)
        with stage(dbg, "lexical"):
            lexical = _lexical_ids(
                conn, workspace_id, query, all_access, gids, settings.retrieval_n_lex
            )
        dbg.dense_n, dbg.lexical_n = len(dense), len(lexical)

        fused = [cid for cid, _ in rrf([dense, lexical], k=settings.rrf_k)]
        dbg.fused_n = len(fused)
        if not fused:
            dbg.finalize()
            return [], dbg

        meta = _fetch_meta(conn, workspace_id, fused)
        ordered = [c for c in fused if c in meta]
        chunk_to_doc = {c: meta[c]["document_id"] for c in ordered}
        capped = cap_by_document(ordered, chunk_to_doc, settings.doc_cap)[: settings.rerank_in]
        dbg.rerank_in_n = len(capped)

    # Phase B: rerank — a network call. No connection held.
    reranker = get_reranker()
    dbg.reranker = type(reranker).__name__
    with stage(dbg, "rerank"):
        before = len(dbg.degraded)
        ranked_ids = reranker.rerank(
            query, [RerankItem(c, meta[c]["text"]) for c in capped], final_k, dbg.degraded
        )
        dbg.rerank_applied = len(dbg.degraded) == before

    results = [_to_retrieved(c, meta[c]) for c in ranked_ids if c in meta]

    # Phase C: neighbor expansion, on a fresh connection.
    with get_conn() as conn:
        with stage(dbg, "expand"):
            _expand_neighbors(conn, workspace_id, results, meta)

    dbg.final_n = len(results)
    dbg.finalize()
    return results, dbg
