import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tech News Hub"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/technewshub"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
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
    WORKER_INTERVAL_SECONDS: int = 300
    HN_MAX_STORIES: int = 30
    HTTP_REQUEST_TIMEOUT: int = 15

    # Translation
    TRANSLATION_ENABLED: bool = True
    TRANSLATION_PROVIDER: str = "mymemory"
    TRANSLATION_API_KEY: str = ""
    TRANSLATION_TARGET_LANGUAGE: str = "pt-BR"
    TRANSLATION_TIMEOUT_SECONDS: int = 10
    TRANSLATION_DEEPL_API_URL: str = ""
    TRANSLATION_LIBRETRANSLATE_API_URL: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
