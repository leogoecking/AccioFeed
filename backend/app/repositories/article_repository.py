import uuid
from datetime import datetime

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.article import Article
from app.models.article_metric import ArticleMetric
from app.models.source import Source


class ArticleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, article_id: uuid.UUID) -> Article | None:
        stmt = (
            select(Article)
            .where(Article.id == article_id)
            .options(
                selectinload(Article.source),
                selectinload(Article.metrics),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_source_and_external_id(
        self, source_id: int, external_id: str
    ) -> Article | None:
        stmt = (
            select(Article)
            .where(Article.source_id == source_id, Article.external_id == external_id)
            .options(
                selectinload(Article.source),
                selectinload(Article.metrics),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    def _build_filter_stmt(
        self,
        stmt,
        source_slug: str | None = None,
        category: str | None = None,
        search: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ):
        if source_slug:
            stmt = stmt.join(Article.source).where(Source.slug == source_slug)
        if category and category.lower() != "all":
            stmt = stmt.where(Article.category == category.lower())
        if search:
            stmt = stmt.where(Article.title.ilike(f"%{search}%"))
        if from_date:
            stmt = stmt.where(Article.published_at >= from_date)
        if to_date:
            stmt = stmt.where(Article.published_at <= to_date)
        return stmt

    async def count_articles(
        self,
        source_slug: str | None = None,
        category: str | None = None,
        search: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> int:
        stmt = select(func.count(distinct(Article.id)))
        stmt = self._build_filter_stmt(stmt, source_slug, category, search, from_date, to_date)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

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
    ) -> list[Article]:
        stmt = select(Article).options(
            selectinload(Article.source),
            selectinload(Article.metrics),
        )
        stmt = self._build_filter_stmt(stmt, source_slug, category, search, from_date, to_date)

        if sort == "popular":
            # Subquery to order by latest score
            score_subq = (
                select(ArticleMetric.score)
                .where(ArticleMetric.article_id == Article.id)
                .order_by(ArticleMetric.captured_at.desc())
                .limit(1)
                .scalar_subquery()
            )
            stmt = stmt.order_by(score_subq.desc().nullslast(), Article.published_at.desc())
        else:
            stmt = stmt.order_by(Article.published_at.desc())

        offset = max(0, (page - 1) * page_size)
        stmt = stmt.offset(offset).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, article: Article) -> Article:
        self.db.add(article)
        await self.db.commit()
        await self.db.refresh(article)
        return article

    async def record_metric(
        self,
        article_id: uuid.UUID,
        score: int | None,
        comments_count: int | None,
    ) -> ArticleMetric:
        metric = ArticleMetric(
            article_id=article_id,
            score=score,
            comments_count=comments_count,
        )
        self.db.add(metric)
        await self.db.commit()
        await self.db.refresh(metric)
        return metric

    async def list_categories(self) -> list[str]:
        stmt = select(distinct(Article.category)).order_by(Article.category.asc())
        result = await self.db.execute(stmt)
        categories = list(result.scalars().all())
        # Default predefined categories for navigation if empty
        defaults = [
            "ai",
            "hardware",
            "dev",
            "linux",
            "opensource",
            "cybersecurity",
            "science",
            "startups",
            "games",
        ]
        all_cats = sorted(set(defaults + [c for c in categories if c]))
        return all_cats
