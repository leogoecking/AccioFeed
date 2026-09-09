from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SourceBase(BaseModel):
    name: str = Field(..., max_length=100)
    slug: str = Field(..., max_length=100)
    type: str = Field(..., max_length=50)
    base_url: str = Field(..., max_length=500)
    feed_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class SourceCreate(SourceBase):
    pass


class SourceSimple(BaseModel):
    name: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class SourcePublic(SourceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
