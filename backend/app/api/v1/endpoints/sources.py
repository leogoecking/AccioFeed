from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.ssrf import SSRFValidationError
from app.schemas.source import (
    FeedValidateRequest,
    FeedValidateResponse,
    SourceCreateCustom,
    SourcePublic,
    SourceUpdate,
    SyncResponse,
)
from app.services.source_service import SourceService
from app.sources.validator import FeedValidationError

router = APIRouter(prefix="/sources", tags=["Sources"])


@router.get("", response_model=list[SourcePublic])
async def list_sources(
    active_only: bool = Query(False, description="Filter only active sources"),
    db: AsyncSession = Depends(get_db),
):
    service = SourceService(db)
    sources = await service.list_sources(active_only=active_only)
    return [SourcePublic.model_validate(s) for s in sources]


@router.post("/validate", response_model=FeedValidateResponse)
async def validate_feed(
    payload: FeedValidateRequest,
    db: AsyncSession = Depends(get_db),
):
    service = SourceService(db)
    try:
        preview = await service.validate_feed(payload.feed_url)
        return FeedValidateResponse(**preview)
    except SSRFValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"URL não permitida por razões de segurança (SSRF): {e}",
        ) from e
    except (FeedValidationError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Feed inválido ou inacessível: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao consultar feed remoto: {e}",
        ) from e


@router.post("", response_model=SourcePublic, status_code=status.HTTP_201_CREATED)
async def create_custom_source(
    payload: SourceCreateCustom,
    db: AsyncSession = Depends(get_db),
):
    service = SourceService(db)
    try:
        source = await service.create_custom_source(
            name=payload.name,
            feed_url=payload.feed_url,
            default_category=payload.default_category,
            base_url=payload.base_url,
            poll_interval_minutes=payload.poll_interval_minutes,
        )
        return SourcePublic.model_validate(source)
    except SSRFValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"URL não permitida (SSRF): {e}",
        ) from e
    except (FeedValidationError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Não foi possível validar o feed para cadastro: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro interno ao criar fonte: {e}",
        ) from e


@router.patch("/{source_id}", response_model=SourcePublic)
async def update_source(
    source_id: int,
    payload: SourceUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = SourceService(db)
    source = await service.update_source(
        source_id=source_id,
        name=payload.name,
        default_category=payload.default_category,
        poll_interval_minutes=payload.poll_interval_minutes,
        is_active=payload.is_active,
    )
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fonte não encontrada",
        )
    return SourcePublic.model_validate(source)


@router.post("/{source_id}/sync", response_model=SyncResponse)
async def sync_single_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = SourceService(db)
    res = await service.sync_single_source(source_id)
    if res.get("status") == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=res["message"],
        )
    return SyncResponse(**res)


@router.post("/sync", response_model=SyncResponse)
async def sync_all_sources(
    force: bool = Query(True, description="Force sync ignoring poll interval"),
    db: AsyncSession = Depends(get_db),
):
    service = SourceService(db)
    res = await service.sync_all_sources(force=force)
    return SyncResponse(**res)
