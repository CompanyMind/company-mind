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
    llm_model: str = "gpt-5.4-nano-2026-03-17"
    embed_model: str = "text-embedding-3-small"
    # Must match web/lib/db/schema.ts EMBED_DIM and the embedding model's output.
    # For OpenAI text-embedding-3-* this is passed as the `dimensions` request param.
    embed_dim: int = 1024

    # --- Retrieval pipeline ---
    retrieval_n_vec: int = 40  # dense candidate pool
    retrieval_n_lex: int = 40  # lexical candidate pool
    rrf_k: int = 60  # RRF smoothing constant
    rerank_in: int = 20  # candidates sent to the reranker
    final_k: int = 8  # chunks kept for the answer
    doc_cap: int = 3  # max chunks one document contributes to fusion
    rerank_base_url: str = ""  # self-hosted cross-encoder reranker; empty → LLM/fake
    rerank_model: str = ""
    contextual_mode: str = "header"  # off | header | llm

    # Fernet key for encrypting Telegram bot tokens at rest.
    telegram_enc_key: str = ""
    # Public URL of the web app, used to build tappable source links in bot replies.
    app_url: str = ""


settings = Settings()


def use_real_models() -> bool:
    """Call a real model provider, or fall back to the deterministic fake?

    - A custom (self-hosted) base URL → always real; an API key is optional
      because many self-hosted endpoints are unauthenticated on the internal net.
    - The default OpenAI base → real only when an API key is present, so tests
      and offline dev with no credentials still fall back to the fake providers.
    """
    if settings.models_base_url and settings.models_base_url != OPENAI_DEFAULT_BASE:
        return True
    return bool(settings.openai_api_key)
