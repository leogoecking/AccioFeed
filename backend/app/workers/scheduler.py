import asyncio
import logging
import signal
from typing import Any

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.http import create_http_client
from app.core.logging import setup_logging
from app.core.seed import seed_sources
from app.repositories.source_repository import SourceRepository
from app.services.collector_service import CollectorService

logger = logging.getLogger("worker")

MAX_CONCURRENT_SOURCES = 4


class IngestionScheduler:
    def __init__(self, interval_seconds: int | None = None):
        self.interval_seconds = interval_seconds or settings.WORKER_INTERVAL_SECONDS
        self._running = False
        self._stop_event = asyncio.Event()

    def handle_stop_signals(self):
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, self.stop)
            except NotImplementedError:
                pass

    def stop(self):
        logger.info("Shutdown signal received. Stopping worker scheduler gracefully...")
        self._running = False
        self._stop_event.set()

    async def run_single_cycle(self, force: bool = False) -> list[dict[str, Any]]:
        # Ensure default sources are present
        async with async_session_factory() as session:
            await seed_sources(session)
            source_repo = SourceRepository(session)
            sources = await source_repo.list_all(active_only=True)

        logger.info(f"sync_started sources={len(sources)}")

        results: list[dict[str, Any]] = []
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_SOURCES)

        async with create_http_client() as shared_client:

            async def process_source(src) -> dict[str, Any]:
                async with semaphore:
                    # Open separate DB session per source task for concurrency safety
                    async with async_session_factory() as session:
                        collector = CollectorService(session)
                        return await collector.collect_from_source(
                            source=src,
                            limit=settings.HN_MAX_STORIES,
                            force=force,
                            http_client=shared_client,
                        )

            tasks = [process_source(source) for source in sources]
            results = await asyncio.gather(*tasks, return_exceptions=False)

        success_count = sum(1 for r in results if r.get("status") == "success")
        fail_count = sum(1 for r in results if r.get("status") == "error")
        new_count = sum(r.get("new", 0) for r in results)

        logger.info(
            f"sync_completed sources={len(sources)} success={success_count} failed={fail_count} new_articles={new_count}"
        )
        return results

    async def start(self, run_once: bool = False, force: bool = False):
        setup_logging(debug=settings.DEBUG)
        self.handle_stop_signals()
        self._running = True

        logger.info(
            f"Worker initialized. Loop interval: {self.interval_seconds}s. Max concurrency: {MAX_CONCURRENT_SOURCES}"
        )

        try:
            first_run = force
            while self._running:
                await self.run_single_cycle(force=first_run)
                first_run = False

                if run_once:
                    logger.info("Single run completed. Exiting worker.")
                    break

                logger.info(f"Waiting {self.interval_seconds}s until next worker check...")
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
                    break
                except TimeoutError:
                    continue
        finally:
            logger.info("Worker stopped.")
