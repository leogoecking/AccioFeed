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


@pytest.mark.asyncio
async def test_search_and_period_filters(async_client: AsyncClient, db_session: AsyncSession):
    from datetime import timedelta

    source_repo = SourceRepository(db_session)
    source = await source_repo.get_or_create(
        slug="tech-blog",
        name="Tech Blog",
        type="rss",
        base_url="https://techblog.example.com",
    )

    service = ArticleService(db_session)
    now = datetime.now(UTC)

    # 1. Recent article (1 hour ago)
    await service.ingest_normalized_article(
        source.id,
        NormalizedArticle(
            external_id="art-recent",
            title="Inteligência Artificial e Novos chips neurais",
            url="https://techblog.example.com/art-recent",
            summary="Uma introdução aos aceleradores neurais modernos.",
            published_at=now - timedelta(hours=1),
            category="ai",
        ),
    )

    # 2. Older article (5 days ago)
    await service.ingest_normalized_article(
        source.id,
        NormalizedArticle(
            external_id="art-older",
            title="Comparativo de placas de vídeo e GPUs",
            url="https://techblog.example.com/art-older",
            summary="Testes de desempenho em computação gráfica.",
            published_at=now - timedelta(days=5),
            category="hardware",
        ),
    )

    # 3. Very old article (45 days ago)
    await service.ingest_normalized_article(
        source.id,
        NormalizedArticle(
            external_id="art-very-old",
            title="História dos microprocessadores",
            url="https://techblog.example.com/art-very-old",
            summary="Evolução da arquitetura x86 e ARM.",
            published_at=now - timedelta(days=45),
            category="hardware",
        ),
    )

    # Test period=24h (only art-recent should match)
    res_24h = await async_client.get("/api/v1/articles?period=24h")
    assert res_24h.status_code == 200
    assert res_24h.json()["total"] == 1
    assert res_24h.json()["items"][0]["title"] == "Inteligência Artificial e Novos chips neurais"

    # Test period=7d (art-recent and art-older should match)
    res_7d = await async_client.get("/api/v1/articles?period=7d")
    assert res_7d.status_code == 200
    assert res_7d.json()["total"] == 2

    # Test period=30d (excludes art-very-old)
    res_30d = await async_client.get("/api/v1/articles?period=30d")
    assert res_30d.status_code == 200
    assert res_30d.json()["total"] == 2

    # Test period=all (all 3 should match)
    res_all = await async_client.get("/api/v1/articles?period=all")
    assert res_all.status_code == 200
    assert res_all.json()["total"] == 3

    # Test sort=oldest
    res_oldest = await async_client.get("/api/v1/articles?sort=oldest")
    assert res_oldest.status_code == 200
    items = res_oldest.json()["items"]
    assert items[0]["title"] == "História dos microprocessadores"

    # Test search with sort=relevance
    res_search = await async_client.get("/api/v1/articles?search=chips&sort=relevance")
    assert res_search.status_code == 200
    assert res_search.json()["total"] == 1
    assert res_search.json()["items"][0]["title"] == "Inteligência Artificial e Novos chips neurais"

    # Test search length limit (> 200 chars should return 422)
    long_query = "a" * 201
    res_invalid = await async_client.get(f"/api/v1/articles?search={long_query}")
    assert res_invalid.status_code == 422
