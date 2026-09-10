from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TranslationRequest(BaseModel):
    """Request payload to translate an article."""

    language: str = Field(
        default="pt-BR",
        min_length=2,
        max_length=10,
        description="Target language code (e.g. pt-BR)",
    )


class ArticleTranslationPublic(BaseModel):
    """Public representation of an article translation."""

    id: UUID
    article_id: UUID
    language: str
    translated_title: str
    translated_summary: str | None = None
    translated_content: str | None = None
    provider: str
    detected_source_language: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
