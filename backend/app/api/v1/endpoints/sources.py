from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.source_repository import SourceRepository
from app.schemas.source import SourcePublic

router = APIRouter(prefix="/sources", tags=["Sources"])


@router.get("", response_model=list[SourcePublic])
async def list_sources(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    repo = SourceRepository(db)
    sources = await repo.list_all(active_only=active_only)
    return [SourcePublic.model_validate(s) for s in sources]
