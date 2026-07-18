from datetime import datetime, timezone

from ..db import get_conn
from ..settings import settings
from .parse import extract_text
from .chunk import chunk_text
from .contextualize import contextualize
from .embed import get_provider


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _vec_literal(vec: list[float]) -> str:
    # pgvector text input format: "[1,2,3]". Inserted with an explicit ::vector
    # cast so this does not depend on a driver adapter for lists.
    return "[" + ",".join(str(x) for x in vec) + "]"


def process_document(
    document_id: str, workspace_id: str, filename: str, mime: str, data: bytes
) -> None:
    # NOTE: use conn.transaction(), NOT `with conn:` — in psycopg3 the connection
    # context manager commits AND closes the connection on exit.
    conn = get_conn()
    try:
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

        parsed = extract_text(filename, mime, data)
        chunks = chunk_text(parsed.text, parsed.pages)
        # Embed a contextualized representation (filename/page header) while the
        # raw chunk text is stored below for citations. Improves recall on short
        # chunks (Anthropic contextual retrieval, lightweight variant).
        embed_inputs = [
            contextualize(c.text, filename, c.page, settings.contextual_mode) for c in chunks
        ]
        vectors = get_provider().embed(embed_inputs) if chunks else []

        with conn.transaction():
            # Idempotent: re-ingesting a document replaces its chunks.
            conn.execute(
                "DELETE FROM chunks WHERE document_id=%s AND workspace_id=%s",
                (document_id, workspace_id),
            )
            for c, vec in zip(chunks, vectors):
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
                (parsed.text, document_id, workspace_id),
            )
            conn.execute(
                "UPDATE ingestion_jobs SET status='done', finished_at=%s "
                "WHERE document_id=%s AND workspace_id=%s",
                (_now(), document_id, workspace_id),
            )
    except Exception as e:  # noqa: BLE001 — record the failure, never crash the worker
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
    finally:
        conn.close()
