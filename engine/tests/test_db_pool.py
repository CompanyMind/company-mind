"""The lazy pool singleton must be built exactly once, under concurrency.

FastAPI runs every sync endpoint in a threadpool, so the first requests after a
boot genuinely race in `_get_pool()`. Unguarded, both threads see `_pool is
None`, both construct a ConnectionPool — each opening connections and spawning
worker threads — and the loser is orphaned. Its `__del__` then tries to join a
worker from inside that worker:

    Exception ignored in: <function ConnectionPool.__del__>
    RuntimeError: cannot join current thread

Seen once in production on 2026-07-28, in the boot window, when the container
healthcheck raced the first real request.

No database needed: the pool class is stubbed, because what is under test is the
initialisation protocol, not Postgres.
"""

import threading

import app.db as db_mod


def test_pool_is_constructed_once_under_concurrent_first_calls(monkeypatch):
    constructed: list[object] = []
    ready = threading.Event()

    class FakePool:
        def connection(self):
            raise AssertionError("not needed for this test")

    def slow_pool(*args, **kwargs):
        # Construction takes real time (opening min_size connections does), so
        # this widens the window a second thread could slip through. A barrier
        # would be sharper but deadlocks the CORRECT implementation, where only
        # one thread ever gets here — the test has to be able to pass.
        constructed.append(None)
        ready.wait(timeout=1.0)
        return FakePool()

    monkeypatch.setattr(db_mod, "_pool", None)
    monkeypatch.setattr(db_mod, "ConnectionPool", slow_pool)

    errors: list[BaseException] = []
    seen: list[object] = []

    def worker():
        try:
            seen.append(db_mod._get_pool())
        except BaseException as e:  # noqa: BLE001 — surfaced by the assertion below
            errors.append(e)

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    # Let every thread reach _get_pool and pile up on the lock, THEN release the
    # in-flight construction. Unguarded, all eight are already past the `is None`
    # check by now and each builds its own pool.
    threading.Event().wait(0.2)
    ready.set()
    for t in threads:
        t.join(timeout=10)

    assert not errors, errors
    assert len(constructed) == 1, f"the pool was constructed {len(constructed)} times"
    assert len({id(p) for p in seen}) == 1, "callers received different pool objects"

    monkeypatch.setattr(db_mod, "_pool", None)


def test_pool_is_reused_after_construction(monkeypatch):
    calls = {"n": 0}

    class FakePool:
        def connection(self):
            return None

    def counting_pool(*args, **kwargs):
        calls["n"] += 1
        return FakePool()

    monkeypatch.setattr(db_mod, "_pool", None)
    monkeypatch.setattr(db_mod, "ConnectionPool", counting_pool)

    first = db_mod._get_pool()
    for _ in range(50):
        assert db_mod._get_pool() is first
    assert calls["n"] == 1

    monkeypatch.setattr(db_mod, "_pool", None)
