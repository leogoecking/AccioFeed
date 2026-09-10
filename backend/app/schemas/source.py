from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SourceBase(BaseModel):
    name: str = Field(..., max_length=100)
    slug: str = Field(..., max_length=100)
    type: str = Field(..., max_length=50)
    base_url: str = Field(..., max_length=500)
    feed_url: str | None = Field(default=None, max_length=500)
    default_category: str = Field(default="technology", max_length=50)
    is_active: bool = True
    poll_interval_minutes: int = 15


class SourceCreate(SourceBase):
    pass


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

    model_config = ConfigDict(from_attributes=True)
