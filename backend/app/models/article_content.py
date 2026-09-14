import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.article import Article


class ContentLevel(enum.StrEnum):
    FULL = "full"
    PARTIAL = "partial"
    METADATA_ONLY = "metadata_only"


class ExtractionStatus(enum.StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    SKIPPED = "skipped"


def determine_content_level(
    content: str | None = None,
    summary: str | None = None,
) -> ContentLevel:
    """Deterministic classification of available editorial content level.

    - FULL: Substantial editorial content (>= 800 chars or >= 150 words).
    - PARTIAL: Short description or abstract (>= 60 chars).
    - METADATA_ONLY: Essentially title, link, or tiny snippet (< 60 chars).
    """
    clean_content = (content or "").strip()
    clean_summary = (summary or "").strip()

    if len(clean_content) >= 800 or len(clean_content.split()) >= 150:
        return ContentLevel.FULL

    if len(clean_summary) >= 60 or len(clean_content) >= 100:
        return ContentLevel.PARTIAL

    return ContentLevel.METADATA_ONLY


class ArticleContent(Base):
    """Stores extracted full-text content and extraction metadata, cleanly decoupled from original feed data."""

    __tablename__ = "article_contents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    extracted_content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    extraction_method: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        default="trafilatura",
    )
    extraction_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=ExtractionStatus.PENDING.value,
        index=True,
    )
    failure_reason: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    extracted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    article: Mapped["Article"] = relationship(
        "Article",
        back_populates="content_detail",
    )

    __table_args__ = (Index("ix_article_contents_status", "extraction_status"),)
