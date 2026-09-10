from app.core.config import settings
from app.translation.base import (
    BaseTranslationProvider,
    TranslationConfigError,
    TranslationDisabledError,
)
from app.translation.deepl import DeepLProvider


def get_translation_provider() -> BaseTranslationProvider:
    """Resolve configured translation provider based on application settings.

    Raises TranslationDisabledError if TRANSLATION_ENABLED is False.
    Raises TranslationConfigError if provider is unknown or misconfigured.
    """
    if not settings.TRANSLATION_ENABLED:
        raise TranslationDisabledError(
            "O serviço de tradução está desativado no momento. Defina TRANSLATION_ENABLED=true para habilitar."
        )

    provider_name = (settings.TRANSLATION_PROVIDER or "").lower().strip()

    if provider_name == "deepl":
        return DeepLProvider()

    raise TranslationConfigError(
        f"Provedor de tradução '{provider_name}' não é suportado. Opções suportadas: 'deepl'."
    )
