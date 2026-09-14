from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article_translation import ArticleTranslation


class TranslationRepository:
    """Repository for querying and persisting article translations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_article_and_language(
        self,
        article_id: UUID,
        language: str,
    ) -> ArticleTranslation | None:
        """Find translation by article ID and normalized language code."""
        normalized_lang = language.strip().lower()
        stmt = select(ArticleTranslation).where(
            ArticleTranslation.article_id == article_id,
            ArticleTranslation.language.ilike(normalized_lang),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_article_id(
        self,
        article_id: UUID,
    ) -> list[ArticleTranslation]:
        """List all translations for a given article."""
        stmt = (
            select(ArticleTranslation)
            .where(ArticleTranslation.article_id == article_id)
            .order_by(ArticleTranslation.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_translation(
        self,
        article_id: UUID,
        language: str,
        translated_title: str,
        translated_summary: str | None = None,
        translated_content: str | None = None,
        provider: str = "deepl",
        detected_source_language: str | None = None,
    ) -> ArticleTranslation:
        """Persist a new article translation."""
        translation = ArticleTranslation(
            article_id=article_id,
            language=language.strip(),
            translated_title=translated_title.strip(),
            translated_summary=translated_summary.strip() if translated_summary else None,
            translated_content=translated_content.strip() if translated_content else None,
            provider=provider,
            detected_source_language=detected_source_language,
        )
        self.session.add(translation)
        await self.session.flush()
        await self.session.refresh(translation)
        return translation

    async def update_translation_content(
        self,
        translation_id: UUID,
        translated_content: str,
        provider: str | None = None,
    ) -> ArticleTranslation | None:
        """Update the translated full-text content of an existing translation record."""
        stmt = select(ArticleTranslation).where(ArticleTranslation.id == translation_id)
        res = await self.session.execute(stmt)
        translation = res.scalar_one_or_none()
        if translation:
            translation.translated_content = translated_content.strip()
            if provider:
                translation.provider = provider
            await self.session.flush()
            await self.session.refresh(translation)
        return translation
