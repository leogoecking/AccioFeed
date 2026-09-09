import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.article_metric import ArticleMetric
    from app.models.source import Source


class Article(Base, TimestampMixin):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sources.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    external_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    url: Mapped[str] = mapped_column(String(2000), index=True, nullable=False)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
        nullable=False,
    )
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    category: Mapped[str] = mapped_column(
        String(50),
        default="general",
        index=True,
        nullable=False,
    )

    # Relationships
    source: Mapped["Source"] = relationship(
        "Source",
        back_populates="articles",
        lazy="joined",
    )
    metrics: Mapped[list["ArticleMetric"]] = relationship(
        "ArticleMetric",
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="desc(ArticleMetric.captured_at)",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_source_external_id"),
        Index("ix_articles_published_category", "published_at", "category"),
    )
