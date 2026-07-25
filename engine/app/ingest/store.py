from datetime import datetime, timezone

from ..db import get_conn
from ..settings import settings
from .prepare import prepare_document


class NoExtractableText(Exception):
    """A document produced zero chunks. Previously this was recorded as
    status='indexed', error=NULL — an empty, unsearchable document that looked
    successfully ingested. A scanned PDF hits this path every time."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _vec_literal(vec: list[float]) -> str:
    # pgvector text input format: "[1,2,3]". Inserted with an explicit ::vector
    # cast so this does not depend on a driver adapter for lists.
    return "[" + ",".join(str(x) for x in vec) + "]"


def process_document(
    document_id: str, workspace_id: str, filename: str, mime: str, data: bytes
) -> None:
    # Three phases, each holding a pooled connection only as long as it needs one.
    # The middle phase (parse/chunk/embed) makes a network call and MUST NOT hold a
    # connection — the pool has ten, and ingest would otherwise starve the ask path.
    try:
        with get_conn() as conn:
            with conn.transaction():
                conn.execute(
                    "UPDATE ingestion_jobs SET status='running', started_at=%s "
                    "WHERE document_id=%s AND workspace_id=%s",
                    (_now(), document_id, workspace_id),
                )
                conn.execute(
                    "UPDATE documents SET status='parsing' WHERE id=%s AND workspace_id=%s",
                    (document_id, workspace_id),
                )

        prepared = prepare_document(filename, mime, data, settings.contextual_mode)

        if not prepared.chunks:
            raise NoExtractableText(
                f"{filename}: parsed to 0 chunks — the file has no extractable text layer"
            )

        with get_conn() as conn:
            with conn.transaction():
                # Idempotent: re-ingesting a document replaces its chunks. Citations
                # survive this (ON DELETE SET NULL) — see migration for citations.
                conn.execute(
                    "DELETE FROM chunks WHERE document_id=%s AND workspace_id=%s",
                    (document_id, workspace_id),
                )
                for c, vec in zip(prepared.chunks, prepared.vectors):
                    conn.execute(
                        "INSERT INTO chunks (document_id, workspace_id, ordinal, text, page, "
                        "char_start, char_end, token_count, embedding) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::vector)",
                        (
                            document_id,
                            workspace_id,
                            c.ordinal,
                            c.text,
                            c.page,
                            c.char_start,
                            c.char_end,
                            c.token_count,
                            _vec_literal(vec),
                        ),
                    )
                conn.execute(
                    "UPDATE documents SET status='indexed', error=NULL, extracted_text=%s "
                    "WHERE id=%s AND workspace_id=%s",
                    (prepared.parsed.text, document_id, workspace_id),
                )
                conn.execute(
                    "UPDATE ingestion_jobs SET status='done', finished_at=%s "
                    "WHERE document_id=%s AND workspace_id=%s",
                    (_now(), document_id, workspace_id),
                )
    except Exception as e:  # noqa: BLE001 — record the failure, never crash the worker
        with get_conn() as conn:
            with conn.transaction():
                conn.execute(
                    "UPDATE documents SET status='failed', error=%s WHERE id=%s AND workspace_id=%s",
                    (str(e)[:500], document_id, workspace_id),
                )
                conn.execute(
                    "UPDATE ingestion_jobs SET status='failed', error=%s, finished_at=%s "
                    "WHERE document_id=%s AND workspace_id=%s",
                    (str(e)[:500], _now(), document_id, workspace_id),
                )
