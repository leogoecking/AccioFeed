import re
import urllib.parse
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.locks import get_sync_lock
from app.models.source import Source
from app.repositories.source_repository import SourceRepository
from app.services.collector_service import CollectorService
from app.sources.validator import FeedValidator


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text or "source"


class SourceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SourceRepository(db)

    async def list_sources(self, active_only: bool = False) -> list[Source]:
        sources = await self.repo.list_all(active_only=active_only)
        if not sources:
            all_sources = await self.repo.list_all(active_only=False)
            if not all_sources:
                from app.core.seed import seed_sources

                await seed_sources(self.db)
                sources = await self.repo.list_all(active_only=active_only)
        return sources

    async def get_source(self, source_id: int) -> Source | None:
        return await self.repo.get_by_id(source_id)

    async def validate_feed(self, feed_url: str) -> dict[str, Any]:
        return await FeedValidator.validate_and_preview(feed_url)

    async def create_custom_source(
        self,
        name: str,
        feed_url: str,
        default_category: str = "technology",
        base_url: str | None = None,
        poll_interval_minutes: int = 15,
    ) -> Source:
        # 1. Validate feed and SSRF
        preview = await self.validate_feed(feed_url)

        # 2. Derive base_url from site_url or feed_url if not provided
        if not base_url:
            if preview.get("site_url"):
                base_url = preview["site_url"]
            else:
                parsed = urllib.parse.urlparse(feed_url)
                base_url = f"{parsed.scheme}://{parsed.netloc}"

        # 3. Generate unique slug
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while await self.repo.get_by_slug(slug):
            counter += 1
            slug = f"{base_slug}-{counter}"

        # 4. Create and persist
        source = Source(
            name=name.strip(),
            slug=slug,
            type="rss",
            base_url=base_url,
            feed_url=feed_url.strip(),
            default_category=default_category.strip().lower(),
            poll_interval_minutes=max(5, poll_interval_minutes),
            is_active=True,
        )
        return await self.repo.create(source)

    async def update_source(
        self,
        source_id: int,
        name: str | None = None,
        default_category: str | None = None,
        poll_interval_minutes: int | None = None,
        is_active: bool | None = None,
    ) -> Source | None:
        return await self.repo.update_source(
            source_id=source_id,
            name=name,
            default_category=default_category,
            poll_interval_minutes=poll_interval_minutes,
            is_active=is_active,
        )

    async def sync_single_source(self, source_id: int) -> dict[str, Any]:
        source = await self.repo.get_by_id(source_id)
        if not source:
            return {"status": "not_found", "message": "Fonte não encontrada."}

        lock = get_sync_lock()
        if lock.locked():
            return {
                "status": "busy",
                "message": "Uma sincronização já está em andamento. Aguarde alguns instantes.",
                "new_articles": 0,
                "sources_processed": 0,
            }

        async with lock:
            collector = CollectorService(self.db)
            res = await collector.collect_from_source(source, force=True)
            if res.get("status") == "success":
                new_count = res.get("new", 0)
                msg = (
                    f"{new_count} novas notícias coletadas de {source.name}."
                    if new_count > 0
                    else f"Nenhuma notícia nova encontrada em {source.name}."
                )
                return {
                    "status": "success",
                    "message": msg,
                    "new_articles": new_count,
                    "sources_processed": 1,
                }
            error_msg = res.get("error") or source.last_error_message or "Falha desconhecida"
            return {
                "status": "error",
                "message": f"Erro ao sincronizar {source.name}: {error_msg}",
                "new_articles": 0,
                "sources_processed": 1,
            }

    async def sync_all_sources(self, force: bool = True) -> dict[str, Any]:
        lock = get_sync_lock()
        if lock.locked():
            return {
                "status": "busy",
                "message": "Uma sincronização já está em andamento. Aguarde alguns instantes.",
                "new_articles": 0,
                "sources_processed": 0,
            }

        async with lock:
            sources = await self.repo.list_all(active_only=True)
            collector = CollectorService(self.db)
            total_new = 0
            sources_success = 0
            for src in sources:
                res = await collector.collect_from_source(src, force=force)
                if res.get("status") == "success":
                    total_new += res.get("new", 0)
                    sources_success += 1

            msg = (
                f"Sincronização concluída: {total_new} novas notícias de {sources_success} fontes."
                if total_new > 0
                else f"Sincronização concluída: nenhuma notícia nova ({sources_success} fontes atualizadas)."
            )
            return {
                "status": "success",
                "message": msg,
                "new_articles": total_new,
                "sources_processed": len(sources),
            }
