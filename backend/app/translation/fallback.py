import logging
from collections.abc import Sequence

from app.translation.base import (
    ArticleTranslationResult,
    BaseTranslationProvider,
    TranslationConfigError,
    TranslationDisabledError,
    TranslationError,
    TranslationResult,
    TranslationUnavailableError,
)

logger = logging.getLogger(__name__)


class FallbackTranslationProvider(BaseTranslationProvider):
    """Composite translation provider that tries multiple providers in sequence.

    If the primary provider fails due to quota (429), network timeout, or service unavailability,
    it automatically falls back to the next available provider.
    """

    def __init__(self, providers: Sequence[BaseTranslationProvider]):
        if not providers:
            raise TranslationConfigError(
                "FallbackTranslationProvider requer pelo menos um provedor."
            )
        self.providers = list(providers)

    @property
    def provider_name(self) -> str:
        return f"fallback({','.join(p.provider_name for p in self.providers)})"

    async def translate(
        self,
        text: str,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        last_error: Exception | None = None
        for provider in self.providers:
            try:
                return await provider.translate(text, target_language, source_language)
            except (TranslationConfigError, TranslationDisabledError):
                raise
            except TranslationError as err:
                logger.warning(
                    "Translation provider '%s' failed: %s. Trying next provider...",
                    provider.provider_name,
                    err.message,
                )
                last_error = err
            except Exception as unk_err:
                logger.warning(
                    "Unexpected error in translation provider '%s': %s. Trying next provider...",
                    provider.provider_name,
                    unk_err,
                )
                last_error = unk_err

        if isinstance(last_error, TranslationError):
            raise last_error
        raise TranslationUnavailableError("Todos os serviços de tradução disponíveis falharam.")

    async def translate_article(
        self,
        title: str,
        summary: str | None,
        content: str | None,
        target_language: str,
        source_language: str | None = None,
    ) -> ArticleTranslationResult:
        last_error: Exception | None = None
        for provider in self.providers:
            try:
                return await provider.translate_article(
                    title, summary, content, target_language, source_language
                )
            except (TranslationConfigError, TranslationDisabledError):
                raise
            except TranslationError as err:
                logger.warning(
                    "Translation provider '%s' failed for article: %s. Trying next provider...",
                    provider.provider_name,
                    err.message,
                )
                last_error = err
            except Exception as unk_err:
                logger.warning(
                    "Unexpected error in translation provider '%s' for article: %s. Trying next provider...",
                    provider.provider_name,
                    unk_err,
                )
                last_error = unk_err

        if isinstance(last_error, TranslationError):
            raise last_error
        raise TranslationUnavailableError("Todos os serviços de tradução disponíveis falharam.")
