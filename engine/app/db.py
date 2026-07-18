import psycopg
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector

from .settings import settings

# A single lazily-opened pool, shared by the API and the bot worker. Replaces the
# previous connect-per-call, which opened (and TLS-negotiated) a fresh Postgres
# connection on every ingest, ask, and poll.
_pool: ConnectionPool | None = None


def _configure(conn: psycopg.Connection) -> None:
    # autocommit so each explicit `with conn.transaction()` block is its own atomic
    # unit — matching the old one-connection-per-call semantics.
    conn.autocommit = True
    register_vector(conn)


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            settings.database_url,
            min_size=1,
            max_size=10,
            configure=_configure,
            open=True,
        )
    return _pool


def get_conn():
    """A pooled connection as a context manager: `with get_conn() as conn: ...`.
    On exit the connection is returned to the pool, not closed."""
    return _get_pool().connection()
