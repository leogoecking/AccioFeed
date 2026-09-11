"""add fts unaccent and gin index

Revision ID: 0005_add_fts_unaccent_gin_index
Revises: 0004_article_translations
Create Date: 2026-09-10 23:45:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_add_fts_unaccent_gin_index"
down_revision: str | None = "0004_article_translations"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")
        op.execute("""
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text AS $$
          SELECT public.unaccent('public.unaccent', $1);
        $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
        """)
        op.execute("""
        CREATE INDEX IF NOT EXISTS ix_articles_search_vector_gin ON articles
        USING gin((
          setweight(to_tsvector('simple', immutable_unaccent(coalesce(title, ''))), 'A') ||
          setweight(to_tsvector('simple', immutable_unaccent(coalesce(summary, ''))), 'B') ||
          setweight(to_tsvector('simple', immutable_unaccent(coalesce(author, '') || ' ' || coalesce(category, ''))), 'C') ||
          setweight(to_tsvector('simple', immutable_unaccent(coalesce(substring(content, 1, 5000), ''))), 'D')
        ));
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_articles_search_vector_gin;")
        op.execute("DROP FUNCTION IF EXISTS immutable_unaccent(text);")
