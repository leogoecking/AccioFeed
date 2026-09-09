"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-09 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Sources table
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        sa.Column("feed_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sources_slug"), "sources", ["slug"], unique=True)

    # 2. Articles table
    op.create_table(
        "articles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("url", sa.String(length=2000), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=2000), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "collected_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("language", sa.String(length=10), server_default="en", nullable=False),
        sa.Column("category", sa.String(length=50), server_default="general", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id", "external_id", name="uq_source_external_id"),
    )
    op.create_index(op.f("ix_articles_source_id"), "articles", ["source_id"], unique=False)
    op.create_index(op.f("ix_articles_external_id"), "articles", ["external_id"], unique=False)
    op.create_index(op.f("ix_articles_title"), "articles", ["title"], unique=False)
    op.create_index(op.f("ix_articles_url"), "articles", ["url"], unique=False)
    op.create_index(op.f("ix_articles_category"), "articles", ["category"], unique=False)
    op.create_index(op.f("ix_articles_published_at"), "articles", ["published_at"], unique=False)
    op.create_index(
        "ix_articles_published_category", "articles", ["published_at", "category"], unique=False
    )

    # 3. Article Metrics table
    op.create_table(
        "article_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("comments_count", sa.Integer(), nullable=True),
        sa.Column(
            "captured_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_article_metrics_article_id"), "article_metrics", ["article_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_article_metrics_article_id"), table_name="article_metrics")
    op.drop_table("article_metrics")
    op.drop_index("ix_articles_published_category", table_name="articles")
    op.drop_index(op.f("ix_articles_published_at"), table_name="articles")
    op.drop_index(op.f("ix_articles_category"), table_name="articles")
    op.drop_index(op.f("ix_articles_url"), table_name="articles")
    op.drop_index(op.f("ix_articles_title"), table_name="articles")
    op.drop_index(op.f("ix_articles_external_id"), table_name="articles")
    op.drop_index(op.f("ix_articles_source_id"), table_name="articles")
    op.drop_table("articles")
    op.drop_index(op.f("ix_sources_slug"), table_name="sources")
    op.drop_table("sources")
