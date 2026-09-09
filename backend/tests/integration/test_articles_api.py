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

    service = ArticleService(db_session)
    item = NormalizedArticle(
        external_id="story-42",
        title="Show HN: A self-hosted tech news hub",
        url="https://github.com/example/tech-news-hub",
        author="agent",
        summary="A clean aggregator for tech news.",
        published_at=datetime.now(UTC),
        category="opensource",
        score=350,
        comments_count=88,
    )
    article, _ = await service.ingest_normalized_article(source.id, item)

    # 1. Test listing
    response = await async_client.get("/api/v1/articles")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    first = data["items"][0]
    assert first["title"] == "Show HN: A self-hosted tech news hub"
    assert first["source"]["slug"] == "hacker-news"
    assert first["metrics"]["score"] == 350
    assert first["metrics"]["comments"] == 88

    # 2. Test filtering by category
    resp_cat = await async_client.get("/api/v1/articles?category=opensource")
    assert resp_cat.status_code == 200
    assert resp_cat.json()["total"] == 1

    resp_cat_other = await async_client.get("/api/v1/articles?category=hardware")
    assert resp_cat_other.status_code == 200
    assert resp_cat_other.json()["total"] == 0

    # 3. Test searching by title
    resp_search = await async_client.get("/api/v1/articles?search=self-hosted")
    assert resp_search.status_code == 200
    assert resp_search.json()["total"] == 1

    resp_search_miss = await async_client.get("/api/v1/articles?search=nonexistent")
    assert resp_search_miss.status_code == 200
    assert resp_search_miss.json()["total"] == 0

    # 4. Test detail endpoint
    resp_detail = await async_client.get(f"/api/v1/articles/{article.id}")
    assert resp_detail.status_code == 200
    detail_data = resp_detail.json()
    assert detail_data["id"] == str(article.id)
    assert detail_data["title"] == article.title

    # 5. Test nonexistent UUID
    fake_id = uuid.uuid4()
    resp_404 = await async_client.get(f"/api/v1/articles/{fake_id}")
    assert resp_404.status_code == 404
