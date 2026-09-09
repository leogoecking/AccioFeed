from fastapi import APIRouter

from app.api.v1.endpoints.articles import router as articles_router
from app.api.v1.endpoints.categories import router as categories_router
from app.api.v1.endpoints.sources import router as sources_router

v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(articles_router)
v1_router.include_router(sources_router)
v1_router.include_router(categories_router)
