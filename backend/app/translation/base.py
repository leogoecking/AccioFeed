import re
from abc import ABC, abstractmethod
from typing import ClassVar

from pydantic import BaseModel


class TranslationError(Exception):
    """Base exception for translation errors."""

    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class TranslationDisabledError(TranslationError):
    """Raised when translation is requested but TRANSLATION_ENABLED is False."""

    def __init__(self, message: str = "O serviço de tradução está desativado no momento."):
        super().__init__(message, status_code=503)


class TranslationConfigError(TranslationError):
    """Raised when translation provider is misconfigured (e.g. missing API key)."""

    def __init__(self, message: str = "Serviço de tradução não configurado corretamente."):
        super().__init__(message, status_code=500)


class TranslationAuthError(TranslationError):
    """Raised on authentication/permission failure with external provider."""

    def __init__(self, message: str = "Falha de autenticação com o provedor de tradução."):
        super().__init__(message, status_code=502)


class TranslationQuotaError(TranslationError):
    """Raised when provider quota or character limit is exceeded."""

    def __init__(self, message: str = "Limite de cota do serviço de tradução atingido."):
        super().__init__(message, status_code=429)


class TranslationUnavailableError(TranslationError):
    """Raised when external provider is down, times out, or returns a 5xx error."""

    def __init__(
        self,
        message: str = "Não foi possível traduzir esta notícia agora. Você ainda pode visualizar o conteúdo original.",
    ):
        super().__init__(message, status_code=503)


class TranslationResult(BaseModel):
    """Result of translating a single text block."""

    text: str
    detected_source_language: str | None = None
    target_language: str
    provider: str


class ArticleTranslationResult(BaseModel):
    """Result of translating an article (title, summary, and content)."""

    translated_title: str
    translated_summary: str | None = None
    translated_content: str | None = None
    detected_source_language: str | None = None
    target_language: str
    provider: str


class BaseTranslationProvider(ABC):
    """Abstract base class for translation providers (DeepL, LibreTranslate, etc.)."""

    # Common Portuguese stopwords for quick local heuristic detection
    PT_STOPWORDS: ClassVar[set[str]] = {
        "não",
        "para",
        "como",
        "mais",
        "sobre",
        "pelo",
        "pela",
        "pelos",
        "pelas",
        "uma",
        "com",
        "está",
        "estão",
        "também",
        "entre",
        "quando",
        "muito",
        "anos",
        "após",
        "você",
        "seus",
        "suas",
        "onde",
        "novo",
        "nova",
        "lança",
        "anuncia",
        "brasileiro",
        "brasil",
    }

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the translation provider (e.g. 'deepl')."""
        pass

    @abstractmethod
    async def translate(
        self,
        text: str,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        """Translate a single text string."""
        pass

    @abstractmethod
    async def translate_article(
        self,
        title: str,
        summary: str | None,
        content: str | None,
        target_language: str,
        source_language: str | None = None,
    ) -> ArticleTranslationResult:
        """Translate article title, summary and optional content."""
        pass

    @classmethod
    def is_text_already_portuguese(cls, text: str, min_word_matches: int = 3) -> bool:
        """Heuristic check to determine if text is already Portuguese.

        Avoids unnecessary external translation calls for feeds that publish in Portuguese.
        """
        if not text or not text.strip():
            return False
        words = re.findall(r"\b[\wÀ-ÿ]+\b", text.lower())
        if not words:
            return False
        match_count = sum(1 for w in words if w in cls.PT_STOPWORDS)
        # If text is short (<= 10 words) like a title, 2 distinct stopwords or 1 strong accent word is enough
        if len(words) <= 10:
            return match_count >= 2
        return match_count >= min_word_matches
