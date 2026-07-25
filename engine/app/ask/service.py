import json
from dataclasses import dataclass

from ..access import resolve_access
from ..db import get_conn
from ..settings import settings, use_real_models
from .answer import Citation, answer_question
from .retrieve import retrieve


@dataclass
class AskResult:
    answer: str
    insufficient: bool
    citations: list[Citation]
    retrieved_chunk_ids: list[str]
    debug: dict


def _model_name() -> str:
    return settings.llm_model if use_real_models() else "fake"


def answer_query(
    workspace_id: str,
    question: str,
    *,
    group_ids: list[str] | None = None,
    all_access: bool = False,
    user_id: str | None = None,
    role: str | None = None,
    telegram_link_id: str | None = None,
    log_question: str | None = None,
) -> AskResult:
    """The single ask path used by every surface (web, Telegram, future MCP):
    permission-scoped retrieval → grounded answer → audit log. Exactly one
    principal (`user_id`+`role` for a web user, OR `telegram_link_id` with
    pre-resolved `group_ids` for a Telegram identity) identifies the caller.
    When `role` is given, access is resolved here — the single access rule."""
    if role is not None:
        with get_conn() as conn:
            group_ids, all_access = resolve_access(conn, workspace_id, user_id or "", role)
    retrieved, dbg = retrieve(workspace_id, question, group_ids=group_ids, all_access=all_access)
    result = answer_question(question, retrieved)
    dbg.degraded.extend(result.degraded)
    chunk_ids = [r.chunk_id for r in retrieved]
    telemetry = dbg.as_dict()
    with get_conn() as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO query_log (workspace_id, user_id, telegram_link_id, question, "
                "retrieved_chunk_ids, model, degraded, timings_ms, candidate_counts, rerank_applied) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    workspace_id, user_id, telegram_link_id, log_question or question,
                    chunk_ids, _model_name(),
                    telemetry["degraded"],
                    json.dumps(telemetry["timings_ms"]),
                    json.dumps(telemetry["candidate_counts"]),
                    telemetry["rerank_applied"],
                ),
            )
    return AskResult(
        result.answer, result.insufficient, result.citations, chunk_ids, telemetry
    )
