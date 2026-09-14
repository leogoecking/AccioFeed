import json
from typing import Any

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AccioFeed"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/technewshub"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Any) -> str:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("postgres://"):
                return v_stripped.replace("postgres://", "postgresql+asyncpg://", 1)
            if v_stripped.startswith("postgresql://") and not v_stripped.startswith(
                "postgresql+asyncpg://"
            ):
                return v_stripped.replace("postgresql://", "postgresql+asyncpg://", 1)
            return v_stripped
        return str(v)

    # CORS
    CORS_ORIGINS: str | list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(item) for item in v]
        return ["*"]

    # Worker & Ingestion
    ENABLE_EMBEDDED_WORKER: bool = True
    WORKER_INTERVAL_SECONDS: int = 300
    HN_MAX_STORIES: int = 30
    HTTP_REQUEST_TIMEOUT: int = 15

    # Full-text Extraction & Enrichment
    FULLTEXT_EXTRACTION_ENABLED: bool = True
    EXTRACTION_TIMEOUT_SECONDS: int = 10
    EXTRACTION_MAX_BYTES: int = 3 * 1024 * 1024
    MAX_EXTRACTION_CONCURRENCY: int = 2

    # Translation
    TRANSLATION_ENABLED: bool = True
    TRANSLATION_PROVIDER: str = "auto"
    TRANSLATION_API_KEY: str = ""
    DEEPL_API_KEY: str = ""
    TRANSLATION_TARGET_LANGUAGE: str = "pt-BR"
    TRANSLATION_TIMEOUT_SECONDS: int = 10
    TRANSLATION_DEEPL_API_URL: str = ""
    TRANSLATION_LIBRETRANSLATE_API_URL: str = ""
    TRANSLATION_MYMEMORY_EMAIL: str = "contact@acciofeed.app"

    @model_validator(mode="after")
    def populate_translation_api_key(self) -> "Settings":
        if not self.TRANSLATION_API_KEY and self.DEEPL_API_KEY:
            self.TRANSLATION_API_KEY = self.DEEPL_API_KEY
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
