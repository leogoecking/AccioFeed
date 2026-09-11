from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.sources.sanitizer import sanitize_text

ALLOWED_SOURCE_CATEGORIES = {
    "technology",
    "dev",
    "ai",
    "hardware",
    "science",
    "linux",
    "general",
    "opensource",
    "cybersecurity",
    "startups",
    "games",
}


class SourceBase(BaseModel):
    name: str = Field(..., max_length=100)
    slug: str = Field(..., max_length=100)
    type: str = Field(..., max_length=50)
    base_url: str = Field(..., max_length=500)
    feed_url: str | None = Field(default=None, max_length=500)
    default_category: str = Field(default="technology", max_length=50)
    is_active: bool = True
    poll_interval_minutes: int = Field(default=15, ge=5, le=1440)


class SourceCreate(SourceBase):
    pass


class SourceCreateCustom(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    feed_url: str = Field(..., min_length=5, max_length=500)
    base_url: str | None = Field(default=None, max_length=500)
    default_category: str = Field(default="technology", max_length=50)
    poll_interval_minutes: int = Field(default=15, ge=5, le=1440)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = sanitize_text(v, max_length=100)
        if not clean or len(clean) < 2:
            raise ValueError("O nome da fonte deve conter pelo menos 2 caracteres válidos.")
        return clean

    @field_validator("feed_url")
    @classmethod
    def validate_feed_url(cls, v: str) -> str:
        trimmed = v.strip()
        if not (trimmed.startswith("http://") or trimmed.startswith("https://")):
            raise ValueError("A URL do feed deve começar com http:// ou https://")
        return trimmed

    @field_validator("default_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ALLOWED_SOURCE_CATEGORIES:
            return "technology"
        return clean


class SourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    default_category: str | None = Field(default=None, max_length=50)
    poll_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    is_active: bool | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def validate_update_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = sanitize_text(v, max_length=100)
        if not clean or len(clean) < 2:
            raise ValueError("O nome da fonte deve conter pelo menos 2 caracteres válidos.")
        return clean

    @field_validator("default_category")
    @classmethod
    def validate_update_category(cls, v: str | None) -> str | None:
        if v is None:
            return None
        clean = v.strip().lower()
        if clean not in ALLOWED_SOURCE_CATEGORIES:
            return "technology"
        return clean


class SourceSimple(BaseModel):
    name: str
    slug: str
    type: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SourcePublic(SourceBase):
    id: int
    last_polled_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error_at: datetime | None = None
    last_error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def status(self) -> str:
        if not self.is_active:
            return "disabled"
        if self.last_error_at:
            if not self.last_success_at or self.last_error_at > self.last_success_at:
                return "error"
            # If there was an error in the past but subsequent poll succeeded
            return "healthy"
        return "healthy"

    model_config = ConfigDict(from_attributes=True)


class FeedValidateRequest(BaseModel):
    feed_url: str = Field(..., min_length=5, max_length=500)

    @field_validator("feed_url")
    @classmethod
    def validate_feed_url(cls, v: str) -> str:
        trimmed = v.strip()
        if not (trimmed.startswith("http://") or trimmed.startswith("https://")):
            raise ValueError("A URL do feed deve começar com http:// ou https://")
        return trimmed


class FeedValidateResponse(BaseModel):
    is_valid: bool
    format: str
    title: str
    description: str | None = None
    site_url: str | None = None
    articles_count: int
    latest_article_title: str | None = None
    latest_article_published_at: str | None = None
    sample_articles: list[dict[str, Any]] = Field(default_factory=list)


class SyncResponse(BaseModel):
    status: str
    message: str
    new_articles: int = 0
    sources_processed: int = 0
