import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.source_repository import SourceRepository


@pytest.mark.asyncio
async def test_get_sources_and_categories(async_client: AsyncClient, db_session: AsyncSession):
    source_repo = SourceRepository(db_session)
    await source_repo.get_or_create(
        slug="hacker-news",
        name="Hacker News",
        type="api",
        base_url="https://news.ycombinator.com",
    )

    # 1. Test sources
    resp_sources = await async_client.get("/api/v1/sources")
    assert resp_sources.status_code == 200
    sources_data = resp_sources.json()
    assert len(sources_data) >= 1
    assert any(s["slug"] == "hacker-news" for s in sources_data)

    # 2. Test categories
    resp_categories = await async_client.get("/api/v1/categories")
    assert resp_categories.status_code == 200
    categories = resp_categories.json()
    assert isinstance(categories, list)
    assert "ai" in categories
    assert "linux" in categories
