import html
import logging
import re
from typing import Any

import httpx

from app.core.config import settings
from app.sources.sanitizer import sanitize_editorial_content
from app.translation.base import (
    ArticleTranslationResult,
    BaseTranslationProvider,
    TranslationQuotaError,
    TranslationResult,
    TranslationUnavailableError,
)

logger = logging.getLogger(__name__)


def _chunk_text(text: str, max_chunk_size: int = 450) -> list[str]:
    """Split text into manageable chunks respecting paragraphs and sentences."""
    if len(text) <= max_chunk_size:
        return [text]

    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for p in paragraphs:
        p_len = len(p)
        if current_len + p_len + 2 <= max_chunk_size:
            current_chunk.append(p)
            current_len += p_len + 2
        else:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_len = 0

            if p_len <= max_chunk_size:
                current_chunk.append(p)
                current_len = p_len
            else:
                sentences = re.split(r"(?<=[.!?])\s+", p)
                sent_chunk: list[str] = []
                sent_len = 0
                for s in sentences:
                    if sent_len + len(s) + 1 <= max_chunk_size:
                        sent_chunk.append(s)
                        sent_len += len(s) + 1
                    else:
                        if sent_chunk:
                            chunks.append(" ".join(sent_chunk))
                            sent_chunk = []
                            sent_len = 0
                        sent_chunk.append(s)
                        sent_len = len(s)
                if sent_chunk:
                    chunks.append(" ".join(sent_chunk))

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks or [text]


class MyMemoryProvider(BaseTranslationProvider):
    """Free machine translation provider using MyMemory API.

    Requires no API key, works immediately out of the box.
    """

    API_URL = "https://api.mymemory.translated.net/get"

    def __init__(
        self,
        api_url: str | None = None,
        timeout_seconds: int | None = None,
        email: str | None = None,
    ):
        self.api_url = api_url or self.API_URL
        self.timeout_seconds = timeout_seconds or settings.TRANSLATION_TIMEOUT_SECONDS
        self.email = (email or settings.TRANSLATION_MYMEMORY_EMAIL or "").strip()

    @property
    def provider_name(self) -> str:
        return "mymemory"

    def _normalize_target_language(self, lang: str) -> str:
        cleaned = lang.strip().upper()
        if cleaned in ("PT", "PT-BR", "PT_BR"):
            return "pt-BR"
        if cleaned in ("PT-PT", "PT_PT"):
            return "pt-PT"
        if cleaned in ("EN", "EN-US", "EN_US"):
            return "en-US"
        return cleaned.lower()

    async def _fetch_single_segment(
        self,
        client: httpx.AsyncClient,
        text: str,
        langpair: str,
    ) -> str:
        """Query MyMemory for a single text segment with error handling."""
        params = {"q": text, "langpair": langpair}
        if self.email:
            params["de"] = self.email

        try:
            response = await client.get(
                self.api_url,
                params=params,
            )
        except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as net_err:
            logger.warning("MyMemory connection error: %s", net_err)
            raise TranslationUnavailableError(
                "Não foi possível conectar ao serviço de tradução gratuito (MyMemory)."
            ) from net_err

        if response.status_code != 200:
            if response.status_code == 429:
                raise TranslationQuotaError("Limite de requisições do MyMemory atingido.")
            raise TranslationUnavailableError(
                f"Serviço de tradução indisponível (HTTP {response.status_code})."
            )

        try:
            data: dict[str, Any] = response.json()
        except Exception as json_err:
            raise TranslationUnavailableError(
                "Resposta inválida do serviço de tradução."
            ) from json_err

        if data.get("responseStatus") == 429 or data.get("quotaFinished") is True:
            raise TranslationQuotaError("Cota diária de tradução gratuita do MyMemory atingida.")

        res_data = data.get("responseData") or {}
        translated = res_data.get("translatedText")
        if translated:
            return html.unescape(translated)

        return text

    async def translate(
        self,
        text: str,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        """Translate a text string."""
        if not text or not text.strip():
            return TranslationResult(
                text=text,
                detected_source_language=source_language,
                target_language=target_language,
                provider=self.provider_name,
            )

        target_lang = self._normalize_target_language(target_language)

        if target_lang == "pt-BR" and self.is_text_already_portuguese(text):
            return TranslationResult(
                text=text,
                detected_source_language="PT",
                target_language=target_lang,
                provider=self.provider_name,
            )

        src = (source_language or "en").lower()
        langpair = f"{src}|{target_lang}"

        chunks = _chunk_text(text)

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            translated_chunks: list[str] = []
            for chunk in chunks:
                part = await self._fetch_single_segment(client, chunk, langpair)
                translated_chunks.append(part)

        combined = " ".join(translated_chunks) if len(chunks) > 1 else translated_chunks[0]

        return TranslationResult(
            text=combined,
            detected_source_language=src.upper(),
            target_language=target_lang,
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
        """Translate article title, summary and content."""
        target_lang = self._normalize_target_language(target_language)
        cleaned_title = title.strip() if title else ""

        if not cleaned_title:
            return ArticleTranslationResult(
                translated_title=title,
                translated_summary=summary,
                translated_content=content,
                detected_source_language=source_language,
                target_language=target_lang,
                provider=self.provider_name,
            )

        if target_lang == "pt-BR" and self.is_text_already_portuguese(cleaned_title):
            return ArticleTranslationResult(
                translated_title=cleaned_title,
                translated_summary=summary,
                translated_content=content,
                detected_source_language="PT",
                target_language=target_lang,
                provider=self.provider_name,
            )

        src = (source_language or "en").lower()
        langpair = f"{src}|{target_lang}"

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            # 1. Translate Title
            translated_title = await self._fetch_single_segment(client, cleaned_title, langpair)

            # 2. Translate Summary (if present)
            translated_summary: str | None = None
            if summary and summary.strip():
                clean_summary = summary.strip()
                chunks = _chunk_text(clean_summary)
                parts = [await self._fetch_single_segment(client, c, langpair) for c in chunks]
                translated_summary = " ".join(parts) if len(parts) > 1 else parts[0]

            # 3. Translate Content (if present and needed)
            translated_content: str | None = None
            if content and content.strip():
                clean_content = sanitize_editorial_content(content)
                if clean_content:
                    chunks = _chunk_text(clean_content)
                    # Limit to first 4 chunks for latency & quota safety
                    parts = [
                        await self._fetch_single_segment(client, c, langpair) for c in chunks[:4]
                    ]
                    translated_content = "\n\n".join(parts) if len(parts) > 1 else parts[0]

        return ArticleTranslationResult(
            translated_title=translated_title,
            translated_summary=translated_summary,
            translated_content=translated_content,
            detected_source_language=src.upper(),
            target_language=target_lang,
            provider=self.provider_name,
        )
