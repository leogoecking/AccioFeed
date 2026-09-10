"""add article translations table

Revision ID: 0004_article_translations
Revises: 0003_article_state
Create Date: 2026-09-09 23:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_article_translations"
down_revision: str | None = "0003_article_state"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "article_translations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False),
        sa.Column("translated_title", sa.String(length=500), nullable=False),
        sa.Column("translated_summary", sa.Text(), nullable=True),
        sa.Column("translated_content", sa.Text(), nullable=True),
        sa.Column("provider", sa.String(length=50), server_default="deepl", nullable=False),
        sa.Column("detected_source_language", sa.String(length=10), nullable=True),
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
        sa.UniqueConstraint(
            "article_id", "language", name="uq_article_translations_article_id_lang"
        ),
    )

    op.create_index("ix_article_translations_article_id", "article_translations", ["article_id"])
    op.create_index("ix_article_translations_language", "article_translations", ["language"])
    op.create_index(
        "ix_article_translations_article_lang",
        "article_translations",
        ["article_id", "language"],
    )


def downgrade() -> None:
    op.drop_index("ix_article_translations_article_lang", table_name="article_translations")
    op.drop_index("ix_article_translations_language", table_name="article_translations")
    op.drop_index("ix_article_translations_article_id", table_name="article_translations")
    op.drop_table("article_translations")
