from pydantic_settings import BaseSettings, SettingsConfigDict

# The default model provider. An on-prem / sovereign deployment overrides
# MODELS_BASE_URL with a self-hosted OpenAI-compatible endpoint so that no
# document text or question ever leaves the customer's infrastructure.
OPENAI_DEFAULT_BASE = "https://api.openai.com/v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
    database_url: str = ""
    engine_internal_secret: str = ""

    # --- Models ---
    # Defaults to OpenAI's hosted API. Point at a self-hosted OpenAI-compatible
    # endpoint for on-prem. WARNING: on the OpenAI default, prompts and source
    # text are sent to OpenAI — that breaks the sovereignty guarantee, so real
    # regulated deployments MUST set MODELS_BASE_URL to their own endpoint.
    models_base_url: str = OPENAI_DEFAULT_BASE
    openai_api_key: str = ""  # required to use the OpenAI default; sent as a Bearer token
    # Deterministic placeholder providers, for tests and offline development
    # ONLY. Must be set explicitly — see use_fake_models() for why this is no
    # longer inferred from "no credentials present".
    fake_models: bool = False
    llm_model: str = "gpt-5.4-nano-2026-03-17"
    embed_model: str = "text-embedding-3-small"
    # Must match web/lib/db/schema.ts EMBED_DIM and the embedding model's output.
    # For OpenAI text-embedding-3-* this is passed as the `dimensions` request param.
    embed_dim: int = 1024
    # Texts per embeddings request. TEI's default --max-client-batch-size is 32,
    # so one-request-per-document fails for any document over roughly 16 pages.
    embed_batch_size: int = 32

    # --- Retrieval pipeline ---
    retrieval_n_vec: int = 40  # dense candidate pool
    retrieval_n_lex: int = 40  # lexical candidate pool
    rrf_k: int = 60  # RRF smoothing constant
    rerank_in: int = 20  # candidates sent to the reranker
    final_k: int = 8  # chunks kept for the answer
    doc_cap: int = 3  # max chunks one document contributes to fusion
    rerank_base_url: str = ""  # self-hosted cross-encoder reranker; empty → LLM/fake
    rerank_model: str = ""
    contextual_mode: str = "header"  # off | header  ('llm' lands in Phase 4)

    # --- Atlas (governance graph) ---
    graph_seed: int = 42
    graph_orphan_threshold: float = 0.15
    graph_stale_days: float = 365
    graph_overexposed_threshold: float = 0.5
    graph_edge_threshold: float = 0.35  # min cosine similarity to draw a doc↔doc edge
    graph_edge_topk: int = 5            # max neighbors per document

    # Fernet key for encrypting Telegram bot tokens at rest.
    telegram_enc_key: str = ""
    # Public URL of the web app, used to build tappable source links in bot replies.
    app_url: str = ""


settings = Settings()

_IMPLEMENTED_CONTEXTUAL_MODES = {"off", "header"}

if settings.contextual_mode not in _IMPLEMENTED_CONTEXTUAL_MODES:
    raise ValueError(
        f"CONTEXTUAL_MODE={settings.contextual_mode!r} is not implemented. "
        f"Supported: {sorted(_IMPLEMENTED_CONTEXTUAL_MODES)}. "
        "'llm' (Summary-Augmented Chunking) arrives in Phase 4 — until then it "
        "silently behaved as 'header', which is why this now fails loudly."
    )


class ModelsNotConfigured(RuntimeError):
    """No model provider is configured and fakes are not permitted.

    Raised instead of quietly serving deterministic placeholder text. The fake
    answer reads exactly like a real cited one — "Based on your sources: … [1]"
    — so a misconfigured deployment used to look like a working one, right up
    until someone trusted the answer. Failing loudly is the whole point.
    """


def use_real_models() -> bool:
    """Is a real model provider configured?

    - A custom (self-hosted) base URL → yes; an API key is optional because many
      self-hosted endpoints are unauthenticated on the internal network.
    - The default OpenAI base → yes only when an API key is present.
    """
    if settings.models_base_url and settings.models_base_url != OPENAI_DEFAULT_BASE:
        return True
    return bool(settings.openai_api_key)


def use_fake_models() -> bool:
    """May the deterministic fake providers stand in for a real model?

    ONLY when FAKE_MODELS is explicitly set. This used to be implied by "no
    credentials configured", which meant the fallback was one missing
    environment variable away in production — and that is exactly how a
    greeting came back as a fabricated extract from the staff handbook.

    The fakes still exist because the test suite needs them: CI runs 148 engine
    tests with no secrets at all (see .github/workflows/ci.yml, which references
    none), and ingestion tests need embeddings that are deterministic, free and
    offline. What they must never again be is an accident.
    """
    return settings.fake_models


def require_models() -> None:
    """Fail loudly when neither a real provider nor an explicit fake is set."""
    if not use_real_models() and not use_fake_models():
        raise ModelsNotConfigured(
            "No model provider configured. Set MODELS_BASE_URL to a self-hosted "
            "OpenAI-compatible endpoint (the on-prem path), or OPENAI_API_KEY to "
            "use the hosted default. Set FAKE_MODELS=1 only for tests and offline "
            "development — it returns placeholder text, never real answers."
        )
