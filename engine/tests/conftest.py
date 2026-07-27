import pytest

from app.settings import settings


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
