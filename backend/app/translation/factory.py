from app.core.config import settings
from app.translation.base import (
    BaseTranslationProvider,
    TranslationConfigError,
    TranslationDisabledError,
)
from app.translation.deepl import DeepLProvider
from app.translation.fallback import FallbackTranslationProvider
from app.translation.google import GoogleTranslateProvider
from app.translation.libretranslate import LibreTranslateProvider
from app.translation.mock import MockTranslationProvider
from app.translation.mymemory import MyMemoryProvider


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

    if provider_name == "google":
        return GoogleTranslateProvider()

    if provider_name in ("mymemory", "free"):
        # Primary MyMemory with automatic Google fallback on 429 quota, connection errors or untranslated echoes
        return FallbackTranslationProvider([MyMemoryProvider(), GoogleTranslateProvider()])

    if provider_name in ("libretranslate", "libre"):
        return LibreTranslateProvider()

    if provider_name in ("mock", "test"):
        return MockTranslationProvider()

    if provider_name in ("auto", ""):
        if settings.TRANSLATION_API_KEY:
            return FallbackTranslationProvider(
                [DeepLProvider(), GoogleTranslateProvider(), MyMemoryProvider()]
            )
        return FallbackTranslationProvider([GoogleTranslateProvider(), MyMemoryProvider()])

    raise TranslationConfigError(
        f"Provedor de tradução '{provider_name}' não é suportado. "
        "Opções suportadas: 'google', 'mymemory', 'deepl', 'libretranslate', 'mock', 'auto'."
    )
