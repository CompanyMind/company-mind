import httpx
import psycopg

from .settings import settings


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
