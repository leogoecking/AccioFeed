from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.seed import seed_sources
from app.models.source import Source
from app.repositories.source_repository import SourceRepository


@pytest.mark.asyncio
async def test_sources_management_crud_and_status(
    async_client: AsyncClient, db_session: AsyncSession
):
    repo = SourceRepository(db_session)
    source = await repo.create(
        Source(
            name="Original Source",
            slug="original-source",
            type="rss",
            base_url="https://orig.com",
            feed_url="https://orig.com/feed.xml",
            default_category="technology",
            is_active=True,
            poll_interval_minutes=15,
        )
    )

    # 1. List sources
    res = await async_client.get("/api/v1/sources")
    assert res.status_code == 200
    items = res.json()
    assert any(s["slug"] == "original-source" for s in items)

    # 2. Patch source: deactivate and change interval
    patch_res = await async_client.patch(
        f"/api/v1/sources/{source.id}",
        json={"is_active": False, "poll_interval_minutes": 60, "name": "Renamed Source"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["is_active"] is False
    assert updated["status"] == "disabled"
    assert updated["poll_interval_minutes"] == 60
    assert updated["name"] == "Renamed Source"

    # 3. List active_only=true should now exclude this source
    active_res = await async_client.get("/api/v1/sources?active_only=true")
    assert active_res.status_code == 200
    active_slugs = [s["slug"] for s in active_res.json()]
    assert "original-source" not in active_slugs

    # 4. Reject arbitrary field in PATCH
    hack_res = await async_client.patch(
        f"/api/v1/sources/{source.id}",
        json={"feed_url": "https://danger.com"},
    )
    assert hack_res.status_code == 422


@pytest.mark.asyncio
async def test_validate_feed_ssrf_and_preview(async_client: AsyncClient):
    # 1. SSRF attack rejection
    ssrf_res = await async_client.post(
        "/api/v1/sources/validate",
        json={"feed_url": "http://127.0.0.1:8000/internal"},
    )
    assert ssrf_res.status_code == 400
    assert "SSRF" in ssrf_res.json()["detail"]

    # 2. Valid preview with mocked safe_fetch_feed
    sample_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
        <channel>
            <title>Linux News Daily</title>
            <link>https://linuxnews.org</link>
            <description>All about Linux and Kernel</description>
            <item>
                <title>Kernel 6.15 Released</title>
                <link>https://linuxnews.org/kernel-615</link>
                <pubDate>Mon, 09 Sep 2026 12:00:00 GMT</pubDate>
            </item>
        </channel>
    </rss>"""

    with patch("app.sources.validator.safe_fetch_feed", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = sample_xml
        valid_res = await async_client.post(
            "/api/v1/sources/validate",
            json={"feed_url": "https://linuxnews.org/rss.xml"},
        )
        assert valid_res.status_code == 200
        preview = valid_res.json()
        assert preview["is_valid"] is True
        assert preview["title"] == "Linux News Daily"
        assert preview["articles_count"] == 1
        assert preview["latest_article_title"] == "Kernel 6.15 Released"


@pytest.mark.asyncio
async def test_create_custom_source(async_client: AsyncClient):
    sample_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
        <channel>
            <title>Dev Weekly</title>
            <link>https://devweekly.com</link>
            <item>
                <title>Rust 2026 Edition</title>
                <link>https://devweekly.com/rust-2026</link>
                <pubDate>Mon, 09 Sep 2026 12:00:00 GMT</pubDate>
            </item>
        </channel>
    </rss>"""

    with patch("app.sources.validator.safe_fetch_feed", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = sample_xml
        create_res = await async_client.post(
            "/api/v1/sources",
            json={
                "name": "Dev Weekly",
                "feed_url": "https://devweekly.com/feed.xml",
                "default_category": "dev",
                "poll_interval_minutes": 20,
            },
        )
        assert create_res.status_code == 201
        data = create_res.json()
        assert data["name"] == "Dev Weekly"
        assert data["slug"] == "dev-weekly"
        assert data["default_category"] == "dev"
        assert data["poll_interval_minutes"] == 20
        assert data["is_active"] is True


@pytest.mark.asyncio
async def test_seed_preserves_user_deactivation(db_session: AsyncSession):
    # Seed initially
    sources = await seed_sources(db_session)
    hn = next(s for s in sources if s.slug == "hacker-news")

    # User manually deactivates Hacker News and customizes interval
    repo = SourceRepository(db_session)
    await repo.update_source(
        source_id=hn.id,
        is_active=False,
        poll_interval_minutes=45,
    )

    # Re-run seed
    await seed_sources(db_session)

    # Verify that Hacker News remains INACTIVE with 45 minutes interval!
    refreshed_hn = await repo.get_by_slug("hacker-news")
    assert refreshed_hn is not None
    assert refreshed_hn.is_active is False
    assert refreshed_hn.poll_interval_minutes == 45


@pytest.mark.asyncio
async def test_sync_source_and_sync_all_endpoints(
    async_client: AsyncClient, db_session: AsyncSession
):
    repo = SourceRepository(db_session)
    source = await repo.create(
        Source(
            name="Test Feed",
            slug="test-feed",
            type="rss",
            base_url="https://testfeed.com",
            feed_url="https://testfeed.com/rss.xml",
            default_category="technology",
            is_active=True,
            poll_interval_minutes=15,
        )
    )

    with patch.object(
        SourceRepository, "record_poll_result", new_callable=AsyncMock
    ), patch(
        "app.services.collector_service.resolve_provider_for_source"
    ) as mock_resolve:
        mock_provider = AsyncMock()
        mock_provider.fetch.return_value = []
        mock_resolve.return_value = mock_provider

        # 1. Test POST /api/v1/sources/{id}/sync
        res = await async_client.post(f"/api/v1/sources/{source.id}/sync")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["sources_processed"] == 1

        # 2. Test POST /api/v1/sources/sync
        res_all = await async_client.post("/api/v1/sources/sync?force=true")
        assert res_all.status_code == 200
        all_data = res_all.json()
        assert all_data["status"] == "success"
        assert all_data["sources_processed"] >= 1
