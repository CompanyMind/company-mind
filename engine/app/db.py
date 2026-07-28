import threading

import psycopg
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector

from .settings import settings

# A single lazily-opened pool, shared by the API and the bot worker. Replaces the
# previous connect-per-call, which opened (and TLS-negotiated) a fresh Postgres
# connection on every ingest, ask, and poll.
_pool: ConnectionPool | None = None

# The lazy init has to be locked. FastAPI runs every sync endpoint in a
# threadpool, so the FIRST two requests after a boot genuinely race here: both
# see `_pool is None`, both construct a ConnectionPool — each opening min_size
# connections and spawning its own worker threads — and only one survives the
# assignment. The loser is orphaned, and when the garbage collector reaches it
# `ConnectionPool.__del__` tries to join a worker from inside that very worker,
# which surfaces as:
#
#     Exception ignored in: <function ConnectionPool.__del__>
#     RuntimeError: cannot join current thread
#
# Observed once in production on 2026-07-28, in the boot window, when the
# container healthcheck raced the first real request. The leaked connection is
# reclaimed eventually, so the effect is small — but "small" is not a reason to
# keep a data race in the one object every query goes through.
_pool_lock = threading.Lock()


def _configure(conn: psycopg.Connection) -> None:
    # autocommit so each explicit `with conn.transaction()` block is its own atomic
    # unit — matching the old one-connection-per-call semantics.
    conn.autocommit = True
    register_vector(conn)


def _get_pool() -> ConnectionPool:
    global _pool
    # Double-checked: the common path (pool already built) stays lock-free.
    if _pool is None:
        with _pool_lock:
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
