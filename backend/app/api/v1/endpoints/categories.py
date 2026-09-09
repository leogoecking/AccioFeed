from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.article_service import ArticleService

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[str])
async def list_categories(
    db: AsyncSession = Depends(get_db),
):
    service = ArticleService(db)
    return await service.list_categories()
