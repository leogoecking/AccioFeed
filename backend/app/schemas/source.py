from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field


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


class SourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    default_category: str | None = Field(default=None, max_length=50)
    poll_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    is_active: bool | None = None

    model_config = ConfigDict(extra="forbid")


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
