import asyncio
import logging
import signal

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.logging import log_event, setup_logging
from app.services.collector_service import CollectorService
from app.sources.registry import ProviderRegistry

logger = logging.getLogger("worker")


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
                # Signal handlers not implemented on some OS/threads
                pass

    def stop(self):
        logger.info("Shutdown signal received. Stopping worker scheduler gracefully...")
        self._running = False
        self._stop_event.set()

    async def run_single_cycle(self):
        providers = ProviderRegistry.list_all()
        logger.info(f"Starting ingestion cycle for {len(providers)} registered providers...")

        async with async_session_factory() as session:
            collector = CollectorService(session)
            for provider in providers:
                if not self._running and self._stop_event.is_set():
                    break
                try:
                    await collector.collect_from_provider(
                        provider=provider,
                        limit=settings.HN_MAX_STORIES,
                    )
                except Exception as e:
                    log_event(
                        logger,
                        logging.ERROR,
                        f"Unhandled exception during collection from {provider.name}: {e}",
                        source=provider.slug,
                        operation="fetch",
                        status="error",
                        reason=str(e),
                    )

    async def start(self, run_once: bool = False):
        setup_logging(debug=settings.DEBUG)
        self.handle_stop_signals()
        self._running = True

        logger.info(
            f"Worker initialized. Interval: {self.interval_seconds}s. Max stories per source: {settings.HN_MAX_STORIES}"
        )

        try:
            while self._running:
                await self.run_single_cycle()

                if run_once:
                    logger.info("Single run completed. Exiting worker.")
                    break

                logger.info(f"Waiting {self.interval_seconds}s until next ingestion cycle...")
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
                    break
                except TimeoutError:
                    continue
        finally:
            logger.info("Worker stopped.")
