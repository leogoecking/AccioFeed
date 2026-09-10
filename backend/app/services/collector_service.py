import logging
import time
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import log_event
from app.models.source import Source
from app.repositories.source_repository import SourceRepository
from app.services.article_service import ArticleService
from app.sources.factory import resolve_provider_for_source

logger = logging.getLogger("collector")


def is_source_due_for_polling(source: Source, now: datetime) -> bool:
    if source.last_polled_at is None:
        return True
    elapsed_seconds = (now - source.last_polled_at).total_seconds()
    required_seconds = max(1, source.poll_interval_minutes) * 60
    return elapsed_seconds >= required_seconds


class CollectorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.source_repo = SourceRepository(db)
        self.article_service = ArticleService(db)

    async def collect_from_source(
        self,
        source: Source,
        limit: int = 30,
        force: bool = False,
        http_client: httpx.AsyncClient | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        if not force and not is_source_due_for_polling(source, now):
            return {
                "source": source.slug,
                "name": source.name,
                "status": "skipped",
                "reason": "interval_not_elapsed",
                "fetched": 0,
                "new": 0,
                "duplicates": 0,
                "duration_ms": 0,
            }

        start_time = time.monotonic()
        source_slug = source.slug
        logger.info(f"source_sync_started source={source_slug}")

        try:
            provider = resolve_provider_for_source(source, http_client=http_client)
            raw_items = await provider.fetch(limit=limit)

            created_count = 0
            updated_count = 0

            for raw in raw_items:
                normalized = provider.normalize(raw)
                if normalized and provider.validate(normalized):
                    _, created = await self.article_service.ingest_normalized_article(
                        source_id=source.id,
                        normalized=normalized,
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

            duration_s = time.monotonic() - start_time
            duration_ms = int(duration_s * 1000)
            total_articles = created_count + updated_count

            # Record successful polling in DB
            await self.source_repo.record_poll_result(source.id, success=True)

            log_event(
                logger,
                logging.INFO,
                f"source_sync_completed source={source_slug} fetched={total_articles} new={created_count} duplicate={updated_count} duration_ms={duration_ms}",
                source=source_slug,
                operation="fetch",
                status="success",
                articles=total_articles,
                duration=duration_s,
            )

            return {
                "source": source_slug,
                "name": source.name,
                "status": "success",
                "fetched": total_articles,
                "new": created_count,
                "duplicates": updated_count,
                "duration_ms": duration_ms,
            }

        except Exception as exc:
            duration_s = time.monotonic() - start_time
            duration_ms = int(duration_s * 1000)
            error_type = exc.__class__.__name__
            error_msg = str(exc) or error_type

            # Record error in DB
            await self.source_repo.record_poll_result(
                source.id,
                success=False,
                error_message=f"{error_type}: {error_msg}",
            )

            log_event(
                logger,
                logging.ERROR,
                f"source_sync_failed source={source_slug} error_type={error_type} reason='{error_msg}'",
                source=source_slug,
                operation="fetch",
                status="error",
                reason=error_type,
                duration=duration_s,
            )

            return {
                "source": source_slug,
                "name": source.name,
                "status": "error",
                "error": error_msg,
                "error_type": error_type,
                "fetched": 0,
                "new": 0,
                "duplicates": 0,
                "duration_ms": duration_ms,
            }
