from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MetricSummary(BaseModel):
    score: int | None = None
    comments: int | None = None

    model_config = ConfigDict(from_attributes=True)


class MetricCreate(BaseModel):
    score: int | None = None
    comments_count: int | None = None
    captured_at: datetime | None = None
