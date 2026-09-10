import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.metric import MetricSummary
from app.schemas.source import SourcePublic, SourceSimple


class ArticleBase(BaseModel):
    title: str = Field(..., max_length=500)
    url: str = Field(..., max_length=2000)
    canonical_url: str | None = Field(default=None, max_length=2000)
    author: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    content: str | None = None
    image_url: str | None = Field(default=None, max_length=2000)
    published_at: datetime
    language: str = Field(default="en", max_length=10)
    category: str = Field(default="general", max_length=50)


class ArticleCreate(ArticleBase):
    source_id: int
    external_id: str = Field(..., max_length=255)
    collected_at: datetime | None = None


class ArticlePublic(BaseModel):
    id: uuid.UUID
    title: str
    url: str
    canonical_url: str | None = None
    source: SourceSimple
    author: str | None = None
    summary: str | None = None
    content: str | None = None
    image_url: str | None = None
    published_at: datetime
    category: str
    metrics: MetricSummary = Field(default_factory=MetricSummary)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_latest_metric(cls, data: Any) -> Any:
        if hasattr(data, "metrics"):
            metrics_list = getattr(data, "metrics", [])
            metric_data = {"score": None, "comments": None}
            if metrics_list and len(metrics_list) > 0:
                latest = metrics_list[0]
                metric_data["score"] = getattr(latest, "score", None)
                metric_data["comments"] = getattr(latest, "comments_count", None)

            if isinstance(data, dict):
                data["metrics"] = metric_data
                return data

            return {
                "id": data.id,
                "title": data.title,
                "url": data.url,
                "canonical_url": getattr(data, "canonical_url", data.url),
                "source": data.source,
                "author": getattr(data, "author", None),
                "summary": getattr(data, "summary", None),
                "content": getattr(data, "content", None),
                "image_url": getattr(data, "image_url", None),
                "published_at": data.published_at,
                "collected_at": getattr(data, "collected_at", None),
                "category": getattr(data, "category", "general"),
                "language": getattr(data, "language", "en"),
                "created_at": getattr(data, "created_at", None),
                "updated_at": getattr(data, "updated_at", None),
                "metrics": metric_data,
            }
        return data


class ArticleDetail(ArticlePublic):
    source: SourcePublic
    collected_at: datetime
    created_at: datetime
    updated_at: datetime
