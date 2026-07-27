"""A misconfigured deployment must fail loudly, not fake an answer.

The fake providers exist for the test suite: CI runs with no secrets at all, and
ingestion tests need embeddings that are deterministic, free and offline. What
they must never be is a silent production fallback — the fake answer reads
exactly like a real cited one ("Based on your sources: … [1]"), so a deployment
missing one environment variable looked like a working one right up until
somebody trusted the answer.
"""

import pytest

from app.ask.answer import answer_question
from app.ask.retrieve import Retrieved
from app.ingest.embed import get_provider
from app.settings import (
    OPENAI_DEFAULT_BASE,
    ModelsNotConfigured,
    require_models,
    settings,
    use_fake_models,
    use_real_models,
)


@pytest.fixture
def unconfigured(monkeypatch):
    """No provider, and no permission to fake one — a misconfigured server."""
    monkeypatch.setattr(settings, "models_base_url", OPENAI_DEFAULT_BASE)
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "fake_models", False)


class TestFakesAreNoLongerImplicit:
    def test_missing_credentials_alone_does_not_authorise_fakes(self, unconfigured):
        # The old rule was "no credentials → use the fake". That is exactly the
        # inference this change removes.
        assert use_real_models() is False
        assert use_fake_models() is False

    def test_require_models_raises_with_an_actionable_message(self, unconfigured):
        with pytest.raises(ModelsNotConfigured) as exc:
            require_models()
        message = str(exc.value)
        assert "MODELS_BASE_URL" in message
        assert "OPENAI_API_KEY" in message
        assert "FAKE_MODELS" in message

    def test_answering_refuses_to_invent_a_reply(self, unconfigured):
        with pytest.raises(ModelsNotConfigured):
            answer_question(
                "what is the retention period?",
                [Retrieved("c1", "d1", "f.txt", 1, 0, 5, "alpha", 1.0)],
            )

    def test_ingestion_refuses_to_invent_embeddings(self, unconfigured):
        # Fake vectors are worse than no vectors: they index cleanly and then
        # retrieve nonsense forever, with nothing to show anything went wrong.
        with pytest.raises(ModelsNotConfigured):
            get_provider()


class TestExplicitFakeStillWorks:
    def test_the_flag_is_what_permits_them(self, unconfigured, monkeypatch):
        monkeypatch.setattr(settings, "fake_models", True)
        assert use_fake_models() is True
        require_models()  # does not raise
        out = answer_question("hello", [])
        assert out.answer


class TestRealProviderIsPreferred:
    def test_a_self_hosted_base_url_is_enough_on_its_own(self, monkeypatch):
        # On-prem endpoints are frequently unauthenticated on the internal net,
        # so a custom base URL must not also demand an API key.
        monkeypatch.setattr(settings, "models_base_url", "http://models.internal:8080/v1")
        monkeypatch.setattr(settings, "openai_api_key", "")
        monkeypatch.setattr(settings, "fake_models", False)
        assert use_real_models() is True
        require_models()

    def test_a_key_is_enough_on_the_hosted_default(self, monkeypatch):
        monkeypatch.setattr(settings, "models_base_url", OPENAI_DEFAULT_BASE)
        monkeypatch.setattr(settings, "openai_api_key", "sk-test")
        monkeypatch.setattr(settings, "fake_models", False)
        assert use_real_models() is True
        require_models()
