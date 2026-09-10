from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.article_state import LibraryStats
from app.services.article_service import ArticleService

router = APIRouter(prefix="/library", tags=["Library"])


@router.get("/stats", response_model=LibraryStats)
async def get_library_stats(
    db: AsyncSession = Depends(get_db),
):
    service = ArticleService(db)
    stats = await service.get_library_stats()
    return LibraryStats(**stats)
