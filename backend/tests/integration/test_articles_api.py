import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.source_repository import SourceRepository
from app.services.article_service import ArticleService
from app.sources.base import NormalizedArticle


@pytest.mark.asyncio
async def test_get_articles_empty(async_client: AsyncClient):
    response = await async_client.get("/api/v1/articles")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_get_articles_and_detail(async_client: AsyncClient, db_session: AsyncSession):
    # Seed data
    source_repo = SourceRepository(db_session)
    source = await source_repo.get_or_create(
        slug="hacker-news",
        name="Hacker News",
        type="api",
        base_url="https://news.ycombinator.com",
    )

    source2 = await source_repo.get_or_create(
        slug="ars-technica",
        name="Ars Technica",
        type="rss",
        base_url="https://arstechnica.com",
    )

    service = ArticleService(db_session)
    item = NormalizedArticle(
        external_id="story-42",
        title="Show HN: A self-hosted AccioFeed hub",
        url="https://github.com/example/tech-news-hub",
        author="agent",
        summary="A clean aggregator for tech news with zero telemetry.",
        published_at=datetime.now(UTC),
        category="opensource",
        score=350,
        comments_count=88,
    )
    article, _ = await service.ingest_normalized_article(source.id, item)

    item2 = NormalizedArticle(
        external_id="ars-101",
        title="New Breakthrough in Solid State Batteries",
        url="https://arstechnica.com/science/batteries",
        author="Ars Staff",
        summary="Automakers announce high energy density cells.",
        published_at=datetime.now(UTC),
        category="science",
        score=None,
        comments_count=None,
    )
    await service.ingest_normalized_article(source2.id, item2)

    # 1. Test listing
    response = await async_client.get("/api/v1/articles")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2

    # 2. Test filtering by source
    resp_source = await async_client.get("/api/v1/articles?source=ars-technica")
    assert resp_source.status_code == 200
    assert resp_source.json()["total"] == 1
    assert resp_source.json()["items"][0]["source"]["slug"] == "ars-technica"

    # 3. Test filtering by category
    resp_cat = await async_client.get("/api/v1/articles?category=opensource")
    assert resp_cat.status_code == 200
    assert resp_cat.json()["total"] == 1

    # 4. Test searching in title
    resp_search_title = await async_client.get("/api/v1/articles?search=Breakthrough")
    assert resp_search_title.status_code == 200
    assert resp_search_title.json()["total"] == 1

    # 5. Test searching in summary
    resp_search_summary = await async_client.get("/api/v1/articles?search=telemetry")
    assert resp_search_summary.status_code == 200
    assert resp_search_summary.json()["total"] == 1
    assert resp_search_summary.json()["items"][0]["title"] == "Show HN: A self-hosted AccioFeed hub"

    # 6. Test sorting by popular
    resp_popular = await async_client.get("/api/v1/articles?sort=popular")
    assert resp_popular.status_code == 200
    assert resp_popular.json()["items"][0]["metrics"]["score"] == 350

    # 7. Test pagination
    resp_page = await async_client.get("/api/v1/articles?page=1&page_size=1")
    assert resp_page.status_code == 200
    pdata = resp_page.json()
    assert len(pdata["items"]) == 1
    assert pdata["total"] == 2
    assert pdata["pages"] == 2

    # 8. Test detail endpoint
    resp_detail = await async_client.get(f"/api/v1/articles/{article.id}")
    assert resp_detail.status_code == 200
    detail_data = resp_detail.json()
    assert detail_data["id"] == str(article.id)
    assert detail_data["title"] == article.title

    # 9. Test nonexistent UUID
    fake_id = uuid.uuid4()
    resp_404 = await async_client.get(f"/api/v1/articles/{fake_id}")
    assert resp_404.status_code == 404
