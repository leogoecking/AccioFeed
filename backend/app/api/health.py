from fastapi import APIRouter

from app.core.config import settings
from app.translation.factory import get_translation_provider

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    provider_name = "disabled"
    try:
        if settings.TRANSLATION_ENABLED:
            provider = get_translation_provider()
            provider_name = provider.provider_name
    except Exception as exc:
        provider_name = f"error: {exc}"

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "0.2.0",
        "translation_provider": provider_name,
    }
