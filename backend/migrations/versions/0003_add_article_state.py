"""add article state table

Revision ID: 0003_article_state
Revises: 0002_source_fields
Create Date: 2026-09-09 22:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_article_state"
down_revision: str | None = "0002_source_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "article_states",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_favorite", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_saved", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("article_id", name="uq_article_states_article_id"),
    )

    op.create_index("ix_article_states_article_id", "article_states", ["article_id"])
    op.create_index("ix_article_states_is_read", "article_states", ["is_read"])
    op.create_index("ix_article_states_is_favorite", "article_states", ["is_favorite"])
    op.create_index("ix_article_states_is_saved", "article_states", ["is_saved"])
    op.create_index("ix_article_states_is_hidden", "article_states", ["is_hidden"])
    op.create_index("ix_article_states_last_opened_at", "article_states", ["last_opened_at"])
    op.create_index(
        "ix_article_states_user_filters",
        "article_states",
        ["is_read", "is_favorite", "is_saved", "is_hidden"],
    )


def downgrade() -> None:
    op.drop_index("ix_article_states_user_filters", table_name="article_states")
    op.drop_index("ix_article_states_last_opened_at", table_name="article_states")
    op.drop_index("ix_article_states_is_hidden", table_name="article_states")
    op.drop_index("ix_article_states_is_saved", table_name="article_states")
    op.drop_index("ix_article_states_is_favorite", table_name="article_states")
    op.drop_index("ix_article_states_is_read", table_name="article_states")
    op.drop_index("ix_article_states_article_id", table_name="article_states")
    op.drop_table("article_states")
