from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.source_repository import SourceRepository
from app.services.article_service import ArticleService
from app.sources.base import NormalizedArticle


@pytest.mark.asyncio
async def test_article_service_ingest_and_deduplicate(db_session: AsyncSession):
    source_repo = SourceRepository(db_session)
    source = await source_repo.get_or_create(
        slug="hacker-news",
        name="Hacker News",
        type="api",
        base_url="https://news.ycombinator.com",
    )

    service = ArticleService(db_session)

    item1 = NormalizedArticle(
        external_id="story-101",
        title="Breakthrough in Quantum Computing",
        url="https://example.com/quantum",
        author="einstein",
        published_at=datetime.now(UTC),
        category="science",
        score=200,
        comments_count=50,
    )

    # 1. Ingest new article
    article, created = await service.ingest_normalized_article(source.id, item1)
    assert created is True
    assert article.title == "Breakthrough in Quantum Computing"
    assert article.external_id == "story-101"
    assert len(article.metrics) == 1
    assert article.metrics[0].score == 200
    assert article.metrics[0].comments_count == 50

    # 2. Ingest duplicate article with updated score & comments
    item1_updated = NormalizedArticle(
        external_id="story-101",
        title="Breakthrough in Quantum Computing",
        url="https://example.com/quantum",
        author="einstein",
        published_at=datetime.now(UTC),
        category="science",
        score=250,
        comments_count=75,
    )

    article_dup, created_dup = await service.ingest_normalized_article(source.id, item1_updated)
    assert created_dup is False
    assert article_dup.id == article.id
    assert len(article_dup.metrics) == 2
    assert article_dup.metrics[0].score == 250
    assert article_dup.metrics[0].comments_count == 75

    # 3. Verify total count in database is still 1
    items, total = await service.list_articles()
    assert total == 1
    assert len(items) == 1
