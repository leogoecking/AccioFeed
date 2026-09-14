import logging
from typing import Any

import httpx

from app.core.config import settings
from app.sources.sanitizer import sanitize_editorial_content
from app.translation.base import (
    ArticleTranslationResult,
    BaseTranslationProvider,
    TranslationAuthError,
    TranslationError,
    TranslationQuotaError,
    TranslationResult,
    TranslationUnavailableError,
)

logger = logging.getLogger(__name__)


class LibreTranslateProvider(BaseTranslationProvider):
    """Self-hosted or public LibreTranslate translation provider."""

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
        timeout_seconds: int | None = None,
    ):
        self.api_url = (
            api_url
            or settings.TRANSLATION_LIBRETRANSLATE_API_URL
            or "http://localhost:5000/translate"
        ).rstrip("/")
        if not self.api_url.endswith("/translate"):
            self.api_url = f"{self.api_url}/translate"

        self.api_key = (api_key or settings.TRANSLATION_API_KEY or "").strip()
        self.timeout_seconds = timeout_seconds or settings.TRANSLATION_TIMEOUT_SECONDS

    @property
    def provider_name(self) -> str:
        return "libretranslate"

    def _normalize_target_language(self, lang: str) -> str:
        cleaned = lang.strip().lower()
        if cleaned in ("pt-br", "pt_br", "pt"):
            return "pt"
        if cleaned.startswith("en"):
            return "en"
        return cleaned

    async def _request_translate(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "auto",
    ) -> str:
        payload: dict[str, Any] = {
            "q": text,
            "source": source_lang,
            "target": target_lang,
            "format": "text",
        }
        if self.api_key:
            payload["api_key"] = self.api_key

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(self.api_url, json=payload)
        except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as net_err:
            raise TranslationUnavailableError(
                f"Não foi possível conectar ao LibreTranslate em {self.api_url}."
            ) from net_err

        if resp.status_code == 200:
            try:
                data = resp.json()
                return data.get("translatedText", text)
            except Exception as json_err:
                raise TranslationUnavailableError(
                    "Resposta inválida do LibreTranslate."
                ) from json_err

        if resp.status_code in (401, 403):
            raise TranslationAuthError("Chave de API do LibreTranslate inválida.")
        if resp.status_code == 429:
            raise TranslationQuotaError("Limite de requisições do LibreTranslate atingido.")

        raise TranslationError(f"Erro no LibreTranslate (HTTP {resp.status_code}).")

    async def translate(
        self,
        text: str,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        if not text or not text.strip():
            return TranslationResult(
                text=text,
                detected_source_language=source_language,
                target_language=target_language,
                provider=self.provider_name,
            )

        target_lang = self._normalize_target_language(target_language)
        if target_lang == "pt" and self.is_text_already_portuguese(text):
            return TranslationResult(
                text=text,
                detected_source_language="PT",
                target_language=target_language,
                provider=self.provider_name,
            )

        src = (source_language or "auto").lower()
        translated = await self._request_translate(text, target_lang, src)

        return TranslationResult(
            text=translated,
            detected_source_language=src.upper(),
            target_language=target_language,
            provider=self.provider_name,
        )

    async def translate_article(
        self,
        title: str,
        summary: str | None,
        content: str | None,
        target_language: str,
        source_language: str | None = None,
    ) -> ArticleTranslationResult:
        target_lang = self._normalize_target_language(target_language)
        cleaned_title = title.strip() if title else ""

        if not cleaned_title:
            return ArticleTranslationResult(
                translated_title=title,
                translated_summary=summary,
                translated_content=content,
                detected_source_language=source_language,
                target_language=target_language,
                provider=self.provider_name,
            )

        if target_lang == "pt" and self.is_text_already_portuguese(cleaned_title):
            return ArticleTranslationResult(
                translated_title=cleaned_title,
                translated_summary=summary,
                translated_content=content,
                detected_source_language="PT",
                target_language=target_language,
                provider=self.provider_name,
            )

        src = (source_language or "auto").lower()
        translated_title = await self._request_translate(cleaned_title, target_lang, src)

        translated_summary: str | None = None
        if summary and summary.strip():
            translated_summary = await self._request_translate(summary.strip(), target_lang, src)

        translated_content: str | None = None
        if content and content.strip():
            clean_content = sanitize_editorial_content(content)
            if clean_content:
                translated_content = await self._request_translate(clean_content, target_lang, src)

        return ArticleTranslationResult(
            translated_title=translated_title,
            translated_summary=translated_summary,
            translated_content=translated_content,
            detected_source_language=src.upper(),
            target_language=target_language,
            provider=self.provider_name,
        )
