import re

import httpx
import psycopg

from .settings import settings


def embed_dim_ok() -> bool | None:
    """The DB is the source of truth for the embedding width. Detect drift between
    the actual chunks.embedding vector(N) and settings.embed_dim. None = unknown."""
    if not settings.database_url:
        return None
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as conn:
            row = conn.execute(
                "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
                "WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'"
            ).fetchone()
        if not row:
            return None
        m = re.search(r"\((\d+)\)", row[0])
        return bool(m) and int(m.group(1)) == settings.embed_dim
    except Exception:
        return None


def db_ok() -> bool:
    if not settings.database_url:
        return False
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


def models_ok() -> bool:
    if not settings.models_base_url:
        return False
    try:
        r = httpx.get(f"{settings.models_base_url}/models", timeout=3)
        return r.status_code < 500
    except Exception:
        return False
