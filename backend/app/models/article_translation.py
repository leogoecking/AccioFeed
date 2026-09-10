import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.article import Article


class ArticleTranslation(Base):
    """Stores persistent translations of an article into a target language."""

    __tablename__ = "article_translations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )
    translated_title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    translated_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    translated_content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="deepl",
    )
    detected_source_language: Mapped[str | None] = mapped_column(
        String(10),
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
        back_populates="translations",
    )

    __table_args__ = (
        UniqueConstraint("article_id", "language", name="uq_article_translations_article_id_lang"),
        Index("ix_article_translations_article_lang", "article_id", "language"),
    )
