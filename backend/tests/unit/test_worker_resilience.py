from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.source import Source
from app.repositories.source_repository import SourceRepository
from app.services.article_service import ArticleService
from app.services.collector_service import CollectorService
from app.sources.base import NormalizedArticle


@pytest.mark.asyncio
async def test_worker_resilience_continues_when_one_source_fails(db_session: AsyncSession):
    source_repo = SourceRepository(db_session)

    s1 = await source_repo.get_or_create(
        slug="source-1-ok",
        name="Source 1 OK",
        type="rss",
        base_url="https://s1.example.com",
        feed_url="https://s1.example.com/rss",
    )
    s2 = await source_repo.get_or_create(
        slug="source-2-timeout",
        name="Source 2 Timeout",
        type="rss",
        base_url="https://s2.example.com",
        feed_url="https://s2.example.com/rss",
    )
    s3 = await source_repo.get_or_create(
        slug="source-3-ok",
        name="Source 3 OK",
        type="rss",
        base_url="https://s3.example.com",
        feed_url="https://s3.example.com/rss",
    )

    collector = CollectorService(db_session)

    mock_articles_s1 = [
        NormalizedArticle(
            external_id="s1-item-1",
            title="Article From Source 1",
            url="https://s1.example.com/item-1",
            published_at=datetime.now(UTC),
        )
    ]
    mock_articles_s3 = [
        NormalizedArticle(
            external_id="s3-item-1",
            title="Article From Source 3",
            url="https://s3.example.com/item-1",
            published_at=datetime.now(UTC),
        )
    ]

    with patch("app.services.collector_service.resolve_provider_for_source") as mock_resolve:
        mock_p1 = MagicMock()
        mock_p1.slug = "source-1-ok"
        mock_p1.name = "Source 1 OK"
        mock_p1.fetch = AsyncMock(return_value=mock_articles_s1)
        mock_p1.normalize = MagicMock(side_effect=lambda x: x)
        mock_p1.validate = MagicMock(return_value=True)

        mock_p2 = MagicMock()
        mock_p2.slug = "source-2-timeout"
        mock_p2.name = "Source 2 Timeout"
        mock_p2.fetch = AsyncMock(
            side_effect=httpx.ConnectTimeout("Connection timed out after 10s")
        )

        mock_p3 = MagicMock()
        mock_p3.slug = "source-3-ok"
        mock_p3.name = "Source 3 OK"
        mock_p3.fetch = AsyncMock(return_value=mock_articles_s3)
        mock_p3.normalize = MagicMock(side_effect=lambda x: x)
        mock_p3.validate = MagicMock(return_value=True)

        def resolve_side_effect(source: Source, *args, **kwargs):
            del args, kwargs
            if source.slug == "source-1-ok":
                return mock_p1
            elif source.slug == "source-2-timeout":
                return mock_p2
            return mock_p3

        mock_resolve.side_effect = resolve_side_effect

        # Run collections sequentially simulating loop
        res1 = await collector.collect_from_source(s1, force=True)
        res2 = await collector.collect_from_source(s2, force=True)
        res3 = await collector.collect_from_source(s3, force=True)

    # Verify results
    assert res1["status"] == "success"
    assert res1["new"] == 1

    assert res2["status"] == "error"
    assert "ConnectTimeout" in res2["error_type"]

    assert res3["status"] == "success"
    assert res3["new"] == 1

    # Verify DB state of sources
    s1_reloaded = await source_repo.get_by_id(s1.id)
    assert s1_reloaded is not None
    assert s1_reloaded.last_success_at is not None
    assert s1_reloaded.last_error_at is None

    s2_reloaded = await source_repo.get_by_id(s2.id)
    assert s2_reloaded is not None
    assert s2_reloaded.last_error_at is not None
    assert "ConnectTimeout" in (s2_reloaded.last_error_message or "")

    s3_reloaded = await source_repo.get_by_id(s3.id)
    assert s3_reloaded is not None
    assert s3_reloaded.last_success_at is not None
    assert s3_reloaded.last_error_at is None

    # Verify articles persisted
    article_service = ArticleService(db_session)
    items, total = await article_service.list_articles()
    assert total == 2
    titles = [it.title for it in items]
    assert "Article From Source 1" in titles
    assert "Article From Source 3" in titles
