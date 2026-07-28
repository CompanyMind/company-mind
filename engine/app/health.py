import re

import httpx

from .db import get_conn
from .settings import OPENAI_DEFAULT_BASE, settings, use_fake_models, use_real_models

# The embedding width is a property of the deployed schema: it cannot change
# without a migration and a restart. Probing it on every /health hit opened a
# fresh Postgres connection each time, which is exactly what the pool exists to
# stop. Resolved once, then cached.
_embed_dim_ok: bool | None = None
_embed_dim_checked = False


def embed_dim_ok() -> bool | None:
    """The DB is the source of truth for the embedding width. Detect drift between
    the actual chunks.embedding vector(N) and settings.embed_dim. None = unknown.

    Uses the shared pool rather than psycopg.connect: this is polled by the
    container healthcheck, and a connect-per-poll both wastes a TLS handshake
    and sidesteps the pool's limits."""
    global _embed_dim_ok, _embed_dim_checked
    if _embed_dim_checked:
        return _embed_dim_ok
    if not settings.database_url:
        return None
    try:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
                "WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'"
            ).fetchone()
        if not row:
            return None  # not cached: the table may not exist yet (pre-migration)
        m = re.search(r"\((\d+)\)", row[0])
        _embed_dim_ok = bool(m) and int(m.group(1)) == settings.embed_dim
        _embed_dim_checked = True
        return _embed_dim_ok
    except Exception:
        # Not cached either: a transient failure must not pin "unknown" forever.
        return None


def db_ok() -> bool:
    if not settings.database_url:
        return False
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


def models_ok() -> bool | None:
    """Is the model provider usable?

    NEVER probes the hosted OpenAI default. /health is polled by the container
    healthcheck, so `httpx.get(f"{models_base_url}/models")` against the default
    base URL meant a request to api.openai.com every few seconds, forever, from
    a product whose central claim is that nothing leaves the customer's network
    — and an unauthenticated one, so it could not even have told you anything
    useful. A reachability probe is not worth contradicting the guarantee.

    - Self-hosted endpoint (MODELS_BASE_URL overridden): probed. It is inside
      the customer's own network, which is the whole point, and "can the engine
      reach the GPU box" is the question an operator actually has.
    - Hosted default: reported from configuration only — True when an API key is
      set, False when not. No network call.
    - Fakes: None, which reads as "not a real provider" rather than as healthy.
    """
    if use_fake_models() and not use_real_models():
        return None
    if not settings.models_base_url:
        return False
    if settings.models_base_url == OPENAI_DEFAULT_BASE:
        return bool(settings.openai_api_key)
    try:
        r = httpx.get(f"{settings.models_base_url.rstrip('/')}/models", timeout=3)
        return r.status_code < 500
    except Exception:
        return False
