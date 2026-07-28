from contextlib import contextmanager

import pytest

from app.settings import settings


@pytest.fixture
def track_checkouts():
    """Count pooled connections a module currently holds.

    Deterministic on purpose. The obvious probe — reading the pool's own
    `pool_size - pool_available` — races: psycopg_pool hands a released
    connection back on a worker thread, so a check taken immediately after a
    `with get_conn()` block exits can still see it as busy. Wrapping the
    module's own `get_conn` counts enters and exits instead, which is exactly
    the question being asked ("is a connection held right now") and cannot
    drift.

    Usage:

        with track_checkouts(some_module) as held:
            ...
            assert held() == 0   # inside a callback, e.g. a stubbed model call
    """

    @contextmanager
    def _track(module, attr: str = "get_conn"):
        original = getattr(module, attr)
        depth = {"n": 0}

        @contextmanager
        def wrapper(*args, **kwargs):
            with original(*args, **kwargs) as conn:
                depth["n"] += 1
                try:
                    yield conn
                finally:
                    depth["n"] -= 1

        setattr(module, attr, wrapper)
        try:
            yield lambda: depth["n"]
        finally:
            setattr(module, attr, original)

    return _track


@pytest.fixture(autouse=True, scope="session")
def _allow_fake_models():
    """Let the deterministic providers stand in, for tests only.

    This used to be implied: with no MODELS_BASE_URL and no OPENAI_API_KEY the
    engine silently fell back to placeholder text. That made the suite work
    without credentials — CI has none, deliberately — but it also meant a
    production deployment missing one environment variable would serve
    fabricated answers that read exactly like real cited ones.

    So the fallback is now explicit, and the only places that may switch it on
    are this file and a developer's own shell. Anything else raises
    ModelsNotConfigured.
    """
    settings.fake_models = True
    yield
