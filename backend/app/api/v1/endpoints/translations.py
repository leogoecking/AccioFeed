from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.translation import ArticleTranslationPublic, TranslationRequest
from app.services.translation_service import TranslationService
from app.translation.base import (
    TranslationAuthError,
    TranslationConfigError,
    TranslationDisabledError,
    TranslationError,
    TranslationQuotaError,
    TranslationUnavailableError,
)

router = APIRouter(prefix="/articles", tags=["Translations"])


@router.get(
    "/{id}/translations",
    response_model=ArticleTranslationPublic,
    summary="Obter tradução de um artigo",
)
async def get_article_translation(
    id: UUID,
    language: str = Query(default="pt-BR", description="Código do idioma (ex: pt-BR)"),
    db: AsyncSession = Depends(get_db),
):
    """Busca a tradução armazenada em cache de um artigo para o idioma solicitado."""
    service = TranslationService(db)
    translation = await service.get_translation(id, language)
    if not translation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tradução não encontrada para este artigo no idioma especificado.",
        )
    return translation


@router.post(
    "/{id}/translations",
    response_model=ArticleTranslationPublic,
    summary="Traduzir artigo sob demanda",
)
async def translate_article(
    id: UUID,
    payload: TranslationRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Solicita a tradução sob demanda de um artigo para português (ou idioma solicitado).

    Se já houver tradução persistida em cache, retorna imediatamente sem chamar a API externa.
    Caso contrário, invoca o provedor de tradução configurado (DeepL), persiste e retorna.
    """
    target_lang = payload.language if payload else "pt-BR"
    service = TranslationService(db)

    # If client already translated and is storing directly in database cache
    if payload and payload.translated_title:
        from sqlalchemy.exc import IntegrityError

        from app.repositories.translation_repository import TranslationRepository

        repo = TranslationRepository(db)
        norm_lang = service._normalize_language(target_lang)
        try:
            translation = await repo.create_translation(
                article_id=id,
                language=norm_lang,
                translated_title=payload.translated_title,
                translated_summary=payload.translated_summary,
                translated_content=payload.translated_content,
                provider=payload.provider or "client_direct",
                detected_source_language=payload.detected_source_language or "EN",
            )
            await db.commit()
            return translation
        except IntegrityError:
            await db.rollback()
            existing = await repo.get_by_article_and_language(id, norm_lang)
            if existing:
                return existing

    try:
        force_full = payload.force_full if payload else False
        translation = await service.translate_article(id, target_lang, force_full=force_full)
        return translation
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(val_err),
        ) from val_err
    except TranslationDisabledError as dis_err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=dis_err.message,
        ) from dis_err
    except TranslationAuthError as auth_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=auth_err.message,
        ) from auth_err
    except TranslationQuotaError as quota_err:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=quota_err.message,
        ) from quota_err
    except TranslationUnavailableError as unav_err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=unav_err.message,
        ) from unav_err
    except TranslationConfigError as cfg_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=cfg_err.message,
        ) from cfg_err
    except TranslationError as tr_err:
        raise HTTPException(
            status_code=tr_err.status_code,
            detail=tr_err.message,
        ) from tr_err
