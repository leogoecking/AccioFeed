import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.article import ArticleDetail, ArticlePublic
from app.schemas.article_state import ArticleStateUpdate
from app.schemas.pagination import PaginatedResponse
from app.services.article_service import ArticleService

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.get("", response_model=PaginatedResponse[ArticlePublic])
async def get_articles(
    source: str | None = Query(None, description="Source slug (e.g. hacker-news)"),
    category: str | None = Query(None, description="Category slug"),
    state: str | None = Query(
        None,
        pattern="^(all|unread|favorite|saved|hidden|history)$",
        description="Filter by personal state collection",
    ),
    search: str | None = Query(
        None, max_length=200, description="Search term in title, summary, author or category"
    ),
    period: str | None = Query(
        None, pattern="^(today|24h|7d|30d|all)$", description="Relative time period"
    ),
    from_date: datetime | None = Query(
        None, alias="from", description="From published datetime (ISO)"
    ),
    to_date: datetime | None = Query(None, alias="to", description="To published datetime (ISO)"),
    sort: str = Query(
        "recent",
        pattern="^(recent|popular|relevance|oldest|history|last_opened)$",
        description="Sort order",
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    service = ArticleService(db)
    items, total = await service.list_articles(
        source_slug=source,
        category=category,
        search=search,
        period=period,
        from_date=from_date,
        to_date=to_date,
        sort=sort,
        page=page,
        page_size=page_size,
        state_filter=state,
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


@router.patch("/{article_id}/state", response_model=ArticlePublic)
async def update_article_state(
    article_id: uuid.UUID,
    payload: ArticleStateUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = ArticleService(db)
    article = await service.update_article_state(
        article_id=article_id,
        is_read=payload.is_read,
        is_favorite=payload.is_favorite,
        is_saved=payload.is_saved,
        is_hidden=payload.is_hidden,
    )
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found",
        )
    return ArticlePublic.model_validate(article)


@router.post("/{article_id}/open", response_model=ArticleDetail)
async def open_article(
    article_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    service = ArticleService(db)
    article = await service.record_article_opened(article_id)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found",
        )
    return ArticleDetail.model_validate(article)
