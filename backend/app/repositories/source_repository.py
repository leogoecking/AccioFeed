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
            # Preserve user customizations (is_active, poll_interval_minutes, default_category)
            # Only update technical endpoints/types if changed
            existing.base_url = base_url
            existing.feed_url = feed_url
            existing.type = type
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

    async def update_source(
        self,
        source_id: int,
        name: str | None = None,
        default_category: str | None = None,
        poll_interval_minutes: int | None = None,
        is_active: bool | None = None,
    ) -> Source | None:
        source = await self.get_by_id(source_id)
        if not source:
            return None

        if name is not None:
            source.name = name.strip()
        if default_category is not None:
            source.default_category = default_category.strip().lower()
        if poll_interval_minutes is not None:
            source.poll_interval_minutes = max(5, poll_interval_minutes)
        if is_active is not None:
            source.is_active = is_active

        await self.db.commit()
        await self.db.refresh(source)
        return source

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
            source.last_error_message = self._format_friendly_error(error_message)

        await self.db.commit()

    @staticmethod
    def _format_friendly_error(raw_error: str | None) -> str | None:
        if not raw_error:
            return None
        low = raw_error.lower()
        err_type = raw_error.split(":")[0].strip() if ":" in raw_error else ""
        prefix = f"{err_type}: " if err_type else ""

        if "timeout" in low:
            return f"{prefix}Tempo limite esgotado ao consultar o feed (Timeout)."
        if "connect" in low:
            return f"{prefix}Falha ao conectar com o servidor do feed."
        if "404" in low:
            return f"{prefix}Feed não encontrado (Erro 404)."
        if "403" in low:
            return f"{prefix}Acesso negado pelo servidor do feed (Erro 403)."
        if "ssrf" in low or "privada" in low or "reservada" in low:
            return f"{prefix}Endereço bloqueado por motivos de segurança."
        clean = raw_error.split("\n")[-1].strip()
        return clean[:200]
