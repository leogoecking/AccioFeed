from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.source import Source


class SourceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, source_id: int) -> Source | None:
        result = await self.db.execute(select(Source).where(Source.id == source_id))
        return result.scalars().first()

    async def get_by_slug(self, slug: str) -> Source | None:
        result = await self.db.execute(select(Source).where(Source.slug == slug))
        return result.scalars().first()

    async def list_all(self, active_only: bool = True) -> list[Source]:
        stmt = select(Source)
        if active_only:
            stmt = stmt.where(Source.is_active.is_(True))
        stmt = stmt.order_by(Source.name.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, source: Source) -> Source:
        self.db.add(source)
        await self.db.commit()
        await self.db.refresh(source)
        return source

    async def get_or_create(
        self,
        slug: str,
        name: str,
        type: str,
        base_url: str,
        feed_url: str | None = None,
        default_category: str = "technology",
        poll_interval_minutes: int = 15,
        is_active: bool = True,
    ) -> Source:
        existing = await self.get_by_slug(slug)
        if existing:
            # Update attributes if needed
            existing.name = name
            existing.type = type
            existing.base_url = base_url
            existing.feed_url = feed_url
            existing.default_category = default_category
            existing.poll_interval_minutes = poll_interval_minutes
            existing.is_active = is_active
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        source = Source(
            name=name,
            slug=slug,
            type=type,
            base_url=base_url,
            feed_url=feed_url,
            default_category=default_category,
            poll_interval_minutes=poll_interval_minutes,
            is_active=is_active,
        )
        return await self.create(source)

    async def record_poll_result(
        self,
        source_id: int,
        success: bool,
        error_message: str | None = None,
    ) -> None:
        source = await self.get_by_id(source_id)
        if not source:
            return

        now = datetime.now(UTC)
        source.last_polled_at = now
        if success:
            source.last_success_at = now
            source.last_error_message = None
        else:
            source.last_error_at = now
            source.last_error_message = error_message[:500] if error_message else None

        await self.db.commit()
