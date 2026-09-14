"""add content_level and article_contents table

Revision ID: 0006_add_content_level_and_article_contents
Revises: 0005_add_fts_unaccent_gin_index
Create Date: 2026-09-13 22:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_add_content_level_and_article_contents"
down_revision: str | None = "0005_add_fts_unaccent_gin_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add content_level to articles
    op.add_column(
        "articles",
        sa.Column("content_level", sa.String(length=20), server_default="partial", nullable=False),
    )
    op.create_index("ix_articles_content_level", "articles", ["content_level"])

    # 2. Create article_contents table
    op.create_table(
        "article_contents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.Column("extracted_content", sa.Text(), nullable=True),
        sa.Column("extraction_method", sa.String(length=50), nullable=True),
        sa.Column(
            "extraction_status",
            sa.String(length=50),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
        sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("article_id", name="uq_article_contents_article_id"),
    )

    op.create_index("ix_article_contents_article_id", "article_contents", ["article_id"])
    op.create_index(
        "ix_article_contents_extraction_status",
        "article_contents",
        ["extraction_status"],
    )


def downgrade() -> None:
    op.drop_index("ix_article_contents_extraction_status", table_name="article_contents")
    op.drop_index("ix_article_contents_article_id", table_name="article_contents")
    op.drop_table("article_contents")
    op.drop_index("ix_articles_content_level", table_name="articles")
    op.drop_column("articles", "content_level")
