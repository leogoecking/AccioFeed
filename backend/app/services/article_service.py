import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.base import utc_now
from app.repositories.article_repository import ArticleRepository
from app.repositories.article_state_repository import ArticleStateRepository
from app.sources.base import NormalizedArticle
from app.sources.url_utils import canonicalize_url


class ArticleService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ArticleRepository(db)
        self.state_repo = ArticleStateRepository(db)

    async def get_article(self, article_id: uuid.UUID) -> Article | None:
        return await self.repo.get_by_id(article_id)

    async def list_articles(
        self,
        source_slug: str | None = None,
        category: str | None = None,
        search: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        sort: str = "recent",
        page: int = 1,
        page_size: int = 20,
        state_filter: str | None = None,
    ) -> tuple[list[Article], int]:
        total = await self.repo.count_articles(
            source_slug=source_slug,
            category=category,
            search=search,
            from_date=from_date,
            to_date=to_date,
            state_filter=state_filter,
        )
        items = await self.repo.list_articles(
            source_slug=source_slug,
            category=category,
            search=search,
            from_date=from_date,
            to_date=to_date,
            sort=sort,
            page=page,
            page_size=page_size,
            state_filter=state_filter,
        )
        return items, total

    async def update_article_state(
        self,
        article_id: uuid.UUID,
        is_read: bool | None = None,
        is_favorite: bool | None = None,
        is_saved: bool | None = None,
        is_hidden: bool | None = None,
    ) -> Article | None:
        article = await self.repo.get_by_id(article_id)
        if not article:
            return None
        state = await self.state_repo.update_state(
            article_id=article_id,
            is_read=is_read,
            is_favorite=is_favorite,
            is_saved=is_saved,
            is_hidden=is_hidden,
        )
        article.state = state
        return article

    async def record_article_opened(self, article_id: uuid.UUID) -> Article | None:
        article = await self.repo.get_by_id(article_id)
        if not article:
            return None
        state = await self.state_repo.record_opened(article_id)
        article.state = state
        return article

    async def get_library_stats(self) -> dict[str, int]:
        return await self.state_repo.get_library_stats()

    async def list_categories(self) -> list[str]:
        return await self.repo.list_categories()

    async def ingest_normalized_article(
        self,
        source_id: int,
        normalized: NormalizedArticle,
    ) -> tuple[Article, bool]:
        """
        Deduplicates by:
        1. (source_id, external_id)
        2. (source_id, canonical_url)
        If already present: updates metrics if changed.
        If new: creates article and initial metric.
        Returns (article, was_created).
        """
        canonical_link = canonicalize_url(normalized.url)

        # 1. Check external_id
        existing = await self.repo.get_by_source_and_external_id(
            source_id=source_id,
            external_id=normalized.external_id,
        )

        # 2. Check canonical_url if not found by external_id
        if not existing and canonical_link:
            existing = await self.repo.get_by_source_and_canonical_url(
                source_id=source_id,
                canonical_url=canonical_link,
            )

        if existing:
            # Check if metrics updated
            latest_metric = existing.metrics[0] if existing.metrics else None
            needs_new_metric = (
                normalized.score is not None or normalized.comments_count is not None
            ) and (
                latest_metric is None
                or latest_metric.score != normalized.score
                or latest_metric.comments_count != normalized.comments_count
            )

            if needs_new_metric:
                await self.repo.record_metric(
                    article_id=existing.id,
                    score=normalized.score,
                    comments_count=normalized.comments_count,
                )

            existing.updated_at = utc_now()
            await self.db.commit()
            await self.db.refresh(existing)
            return existing, False

        # Create new article
        new_article = Article(
            source_id=source_id,
            external_id=normalized.external_id,
            title=normalized.title,
            url=normalized.url,
            canonical_url=canonical_link,
            author=normalized.author,
            summary=normalized.summary,
            content=normalized.content,
            image_url=normalized.image_url,
            published_at=normalized.published_at,
            category=normalized.category,
            language=normalized.language,
        )

        saved = await self.repo.create(new_article)

        # Record initial metrics if available
        if normalized.score is not None or normalized.comments_count is not None:
            await self.repo.record_metric(
                article_id=saved.id,
                score=normalized.score,
                comments_count=normalized.comments_count,
            )

        await self.db.refresh(saved)
        return saved, True
