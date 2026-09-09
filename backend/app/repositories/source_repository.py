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
        is_active: bool = True,
    ) -> Source:
        existing = await self.get_by_slug(slug)
        if existing:
            return existing

        source = Source(
            name=name,
            slug=slug,
            type=type,
            base_url=base_url,
            feed_url=feed_url,
            is_active=is_active,
        )
        return await self.create(source)
