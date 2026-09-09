import logging
import time

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import log_event
from app.repositories.source_repository import SourceRepository
from app.services.article_service import ArticleService
from app.sources.base import BaseSourceProvider

logger = logging.getLogger("collector")


class CollectorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.source_repo = SourceRepository(db)
        self.article_service = ArticleService(db)

    async def collect_from_provider(
        self,
        provider: BaseSourceProvider,
        limit: int = 30,
    ) -> dict[str, int]:
        start_time = time.monotonic()
        source_slug = provider.slug

        try:
            # Ensure the source entity exists in the DB
            source = await self.source_repo.get_or_create(
                slug=provider.slug,
                name=provider.name,
                type=provider.source_type,
                base_url=provider.base_url,
                feed_url=provider.feed_url,
            )

            # Fetch raw items from external source
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

            duration = time.monotonic() - start_time
            total_articles = created_count + updated_count

            log_event(
                logger,
                logging.INFO,
                f"Successfully collected {total_articles} articles from {provider.name} (new={created_count}, updated={updated_count})",
                source=source_slug,
                operation="fetch",
                status="success",
                articles=total_articles,
                duration=duration,
            )

            return {
                "total": total_articles,
                "created": created_count,
                "updated": updated_count,
            }

        except Exception as exc:
            duration = time.monotonic() - start_time
            reason = str(exc) or exc.__class__.__name__
            log_event(
                logger,
                logging.ERROR,
                f"Failed to collect from {provider.name}: {reason}",
                source=source_slug,
                operation="fetch",
                status="error",
                reason=reason,
                duration=duration,
            )
            return {"total": 0, "created": 0, "updated": 0}
