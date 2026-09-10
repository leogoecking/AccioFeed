from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.source_repository import SourceRepository
from app.services.article_service import ArticleService
from app.sources.base import NormalizedArticle


@pytest.mark.asyncio
async def test_article_state_workflow(async_client: AsyncClient, db_session: AsyncSession):
    source_repo = SourceRepository(db_session)
    source = await source_repo.get_or_create(
        slug="test-source",
        name="Test Source",
        type="rss",
        base_url="https://test.com",
    )

    service = ArticleService(db_session)
    art1, _ = await service.ingest_normalized_article(
        source_id=source.id,
        normalized=NormalizedArticle(
            external_id="art-1",
            title="Article One",
            url="https://test.com/1",
            published_at=datetime.now(UTC),
            category="ai",
        ),
    )
    art2, _ = await service.ingest_normalized_article(
        source_id=source.id,
        normalized=NormalizedArticle(
            external_id="art-2",
            title="Article Two",
            url="https://test.com/2",
            published_at=datetime.now(UTC),
            category="hardware",
        ),
    )

    art1_id = str(art1.id)
    art2_id = str(art2.id)

    # 1. Initial stats: 2 unread, 0 saved, 0 favorites, 2 total
    stats_res = await async_client.get("/api/v1/library/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["unread"] == 2
    assert stats["saved"] == 0
    assert stats["favorites"] == 0

    # 2. Favorite art1
    fav_res = await async_client.patch(
        f"/api/v1/articles/{art1_id}/state",
        json={"is_favorite": True},
    )
    assert fav_res.status_code == 200
    assert fav_res.json()["state"]["is_favorite"] is True

    # 3. Save art1 for later
    save_res = await async_client.patch(
        f"/api/v1/articles/{art1_id}/state",
        json={"is_saved": True},
    )
    assert save_res.status_code == 200
    assert save_res.json()["state"]["is_saved"] is True
    assert save_res.json()["state"]["saved_at"] is not None

    # 4. Filter state=favorite
    fav_list = await async_client.get("/api/v1/articles?state=favorite")
    assert fav_list.status_code == 200
    items = fav_list.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == art1_id

    # 5. Filter state=saved
    saved_list = await async_client.get("/api/v1/articles?state=saved")
    assert saved_list.status_code == 200
    assert len(saved_list.json()["items"]) == 1

    # 6. Reject arbitrary field
    hack_res = await async_client.patch(
        f"/api/v1/articles/{art1_id}/state",
        json={"title": "Unauthorized modification"},
    )
    assert hack_res.status_code == 422

    # 7. Open art1 (records open and marks as read)
    open1_res = await async_client.post(f"/api/v1/articles/{art1_id}/open")
    assert open1_res.status_code == 200
    opened_data = open1_res.json()["state"]
    assert opened_data["is_read"] is True
    first_open = opened_data["first_opened_at"]
    assert first_open is not None

    # 8. Open art1 second time: first_opened_at preserved
    open2_res = await async_client.post(f"/api/v1/articles/{art1_id}/open")
    assert open2_res.status_code == 200
    opened2_data = open2_res.json()["state"]
    assert opened2_data["first_opened_at"] == first_open

    # 9. Hide art2
    hide_res = await async_client.patch(
        f"/api/v1/articles/{art2_id}/state",
        json={"is_hidden": True},
    )
    assert hide_res.status_code == 200
    assert hide_res.json()["state"]["is_hidden"] is True

    # 10. Default timeline excludes hidden article
    timeline = await async_client.get("/api/v1/articles")
    assert timeline.status_code == 200
    timeline_ids = [item["id"] for item in timeline.json()["items"]]
    assert art2_id not in timeline_ids
    assert art1_id in timeline_ids

    # 11. Hidden filter shows hidden article
    hidden_list = await async_client.get("/api/v1/articles?state=hidden")
    assert hidden_list.status_code == 200
    hidden_ids = [item["id"] for item in hidden_list.json()["items"]]
    assert art2_id in hidden_ids

    # 12. Stats after operations:
    # art1 is read, art2 is hidden -> unread is 0
    final_stats_res = await async_client.get("/api/v1/library/stats")
    final_stats = final_stats_res.json()
    assert final_stats["unread"] == 0
    assert final_stats["favorites"] == 1
    assert final_stats["saved"] == 1
