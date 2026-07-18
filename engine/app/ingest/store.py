from datetime import datetime, timezone

from ..db import get_conn
from .parse import extract_text
from .chunk import chunk_text
from .embed import get_provider


def _now() -> datetime:
    return datetime.now(timezone.utc)


def process_document(
    document_id: str, workspace_id: str, filename: str, mime: str, data: bytes
) -> None:
    conn = get_conn()
    try:
        with conn:
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
        vectors = get_provider().embed([c.text for c in chunks]) if chunks else []

        with conn:
            # Idempotent: re-ingesting a document replaces its chunks.
            conn.execute(
                "DELETE FROM chunks WHERE document_id=%s AND workspace_id=%s",
                (document_id, workspace_id),
            )
            for c, vec in zip(chunks, vectors):
                conn.execute(
                    "INSERT INTO chunks (document_id, workspace_id, ordinal, text, page, "
                    "char_start, char_end, token_count, embedding) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (
                        document_id,
                        workspace_id,
                        c.ordinal,
                        c.text,
                        c.page,
                        c.char_start,
                        c.char_end,
                        c.token_count,
                        vec,
                    ),
                )
            conn.execute(
                "UPDATE documents SET status='indexed', error=NULL "
                "WHERE id=%s AND workspace_id=%s",
                (document_id, workspace_id),
            )
            conn.execute(
                "UPDATE ingestion_jobs SET status='done', finished_at=%s "
                "WHERE document_id=%s AND workspace_id=%s",
                (_now(), document_id, workspace_id),
            )
    except Exception as e:  # noqa: BLE001 — record the failure, never crash the worker
        with conn:
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
