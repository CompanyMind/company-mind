from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
    database_url: str = ""
    engine_internal_secret: str = ""
    models_base_url: str = ""
    embed_model: str = ""
    llm_model: str = ""
    # Must match web/lib/db/schema.ts EMBED_DIM and the embedding model's output.
    embed_dim: int = 1024
    # Fernet key for encrypting Telegram bot tokens at rest.
    telegram_enc_key: str = ""


settings = Settings()
