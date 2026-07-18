from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
    database_url: str = ""
    engine_internal_secret: str = ""
    models_base_url: str = ""
    embed_model: str = ""
    llm_model: str = ""


settings = Settings()
