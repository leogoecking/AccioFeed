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
    assert article.canonical_url == "https://example.com/quantum"
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


@pytest.mark.asyncio
async def test_deduplication_by_canonical_url_with_different_utm(db_session: AsyncSession):
    source_repo = SourceRepository(db_session)
    source = await source_repo.get_or_create(
        slug="ars-technica",
        name="Ars Technica",
        type="rss",
        base_url="https://arstechnica.com",
    )

    service = ArticleService(db_session)

    # First fetch: has utm_source=rss
    item1 = NormalizedArticle(
        external_id="guid-abc-1",
        title="New Open Source Kernel Released",
        url="https://arstechnica.com/gadgets/2026/09/kernel-update/?utm_source=rss&utm_medium=feed",
        author="Tech Reporter",
        published_at=datetime.now(UTC),
        category="linux",
    )
    art1, created1 = await service.ingest_normalized_article(source.id, item1)
    assert created1 is True
    assert art1.canonical_url == "https://arstechnica.com/gadgets/2026/09/kernel-update"

    # Second fetch: different guid or external_id, but same canonical URL with different utm_campaign
    item2 = NormalizedArticle(
        external_id="guid-abc-2-different",
        title="New Open Source Kernel Released",
        url="https://arstechnica.com/gadgets/2026/09/kernel-update/?utm_campaign=social&fbclid=xyz",
        author="Tech Reporter",
        published_at=datetime.now(UTC),
        category="linux",
    )
    art2, created2 = await service.ingest_normalized_article(source.id, item2)
    assert created2 is False
    assert art2.id == art1.id

    # Third fetch: completely different URL should be created
    item3 = NormalizedArticle(
        external_id="guid-other",
        title="Another Distinct Article",
        url="https://arstechnica.com/gadgets/2026/09/another-post",
        author="Another Author",
        published_at=datetime.now(UTC),
        category="hardware",
    )
    art3, created3 = await service.ingest_normalized_article(source.id, item3)
    assert created3 is True
    assert art3.id != art1.id

    items, total = await service.list_articles()
    assert total == 2
