import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.v1.router import v1_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.workers.scheduler import IngestionScheduler


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging(debug=settings.DEBUG)
    worker_task = None
    scheduler = None

    if settings.ENABLE_EMBEDDED_WORKER:
        scheduler = IngestionScheduler()
        worker_task = asyncio.create_task(scheduler.start())

    try:
        yield
    finally:
        if scheduler:
            scheduler.stop()
        if worker_task:
            try:
                await asyncio.wait_for(worker_task, timeout=5)
            except (TimeoutError, asyncio.CancelledError):
                worker_task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Intelligent and self-hosted tech news aggregator API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

cors_credentials = "*" not in settings.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(v1_router)
