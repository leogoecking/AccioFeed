import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.article import ArticleDetail, ArticlePublic
from app.schemas.pagination import PaginatedResponse
from app.services.article_service import ArticleService

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.get("", response_model=PaginatedResponse[ArticlePublic])
async def get_articles(
    source: str | None = Query(None, description="Source slug (e.g. hacker-news)"),
    category: str | None = Query(None, description="Category slug"),
    search: str | None = Query(None, description="Search term in title"),
    from_date: datetime | None = Query(
        None, alias="from", description="From published datetime (ISO)"
    ),
    to_date: datetime | None = Query(None, alias="to", description="To published datetime (ISO)"),
    sort: str = Query("recent", pattern="^(recent|popular)$", description="Sort order"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    service = ArticleService(db)
    items, total = await service.list_articles(
        source_slug=source,
        category=category,
        search=search,
        from_date=from_date,
        to_date=to_date,
        sort=sort,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse(
        items=[ArticlePublic.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{article_id}", response_model=ArticleDetail)
async def get_article_by_id(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    service = ArticleService(db)
    article = await service.get_article(article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found",
        )
    return ArticleDetail.model_validate(article)
