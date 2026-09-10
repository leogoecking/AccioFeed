"""add source fields and canonical url

Revision ID: 0002_source_fields
Revises: 0001_initial
Create Date: 2026-09-09 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_source_fields"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Update sources table
    op.add_column(
        "sources",
        sa.Column(
            "default_category",
            sa.String(length=50),
            server_default="technology",
            nullable=False,
        ),
    )
    op.add_column(
        "sources",
        sa.Column(
            "poll_interval_minutes",
            sa.Integer(),
            server_default="15",
            nullable=False,
        ),
    )
    op.add_column(
        "sources",
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sources",
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sources",
        sa.Column("last_error_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sources",
        sa.Column("last_error_message", sa.String(length=500), nullable=True),
    )

    # 2. Update articles table
    op.add_column(
        "articles",
        sa.Column(
            "canonical_url",
            sa.String(length=2000),
            server_default="",
            nullable=False,
        ),
    )
    # Populate existing rows
    op.execute(
        "UPDATE articles SET canonical_url = url WHERE canonical_url = '' OR canonical_url IS NULL"
    )

    op.create_index(op.f("ix_articles_canonical_url"), "articles", ["canonical_url"], unique=False)
    op.create_index(
        "ix_articles_source_canonical_url",
        "articles",
        ["source_id", "canonical_url"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_articles_source_canonical_url", table_name="articles")
    op.drop_index(op.f("ix_articles_canonical_url"), table_name="articles")
    op.drop_column("articles", "canonical_url")
    op.drop_column("sources", "last_error_message")
    op.drop_column("sources", "last_error_at")
    op.drop_column("sources", "last_success_at")
    op.drop_column("sources", "last_polled_at")
    op.drop_column("sources", "poll_interval_minutes")
    op.drop_column("sources", "default_category")
