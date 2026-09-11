import asyncio
import logging
import re
from typing import Any

import httpx

from app.core.config import settings
from app.sources.sanitizer import sanitize_text
from app.translation.base import (
    ArticleTranslationResult,
    BaseTranslationProvider,
    TranslationQuotaError,
    TranslationResult,
    TranslationUnavailableError,
)

logger = logging.getLogger(__name__)


def _chunk_text_google(text: str, max_chunk_size: int = 700) -> list[str]:
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


class GoogleTranslateProvider(BaseTranslationProvider):
    """Free machine translation provider using Google's dictionary/translation API.

    Requires no API key, works seamlessly across datacenter networks.
    """

    API_URL = "https://clients5.google.com/translate_a/t"

    def __init__(
        self,
        api_url: str | None = None,
        timeout_seconds: int | None = None,
    ):
        self.api_url = api_url or self.API_URL
        self.timeout_seconds = timeout_seconds or settings.TRANSLATION_TIMEOUT_SECONDS

    @property
    def provider_name(self) -> str:
        return "google"

    def _normalize_target_language(self, lang: str) -> str:
        cleaned = lang.strip().lower()
        if cleaned in ("pt-br", "pt_br", "pt"):
            return "pt-BR"
        if cleaned in ("pt-pt", "pt_pt"):
            return "pt-PT"
        if cleaned.startswith("en"):
            return "en"
        return cleaned

    async def _fetch_single_segment(
        self,
        client: httpx.AsyncClient,
        text: str,
        target_lang: str,
        source_lang: str = "auto",
    ) -> tuple[str, str | None]:
        """Fetch translation for a single text chunk."""
        params = {
            "client": "dict-chrome-ex",
            "sl": source_lang,
            "tl": target_lang,
            "q": text,
        }
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "*/*",
        }

        try:
            response = await client.get(
                self.api_url,
                params=params,
                headers=headers,
            )
        except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as net_err:
            logger.warning("Google Translate connection error: %s", net_err)
            raise TranslationUnavailableError(
                "Não foi possível conectar ao serviço de tradução gratuito (Google)."
            ) from net_err

        if response.status_code != 200:
            if response.status_code == 429:
                raise TranslationQuotaError(
                    "Limite temporário de requisições atingido. Tente em instantes."
                )
            raise TranslationUnavailableError(
                f"Serviço de tradução indisponível (HTTP {response.status_code})."
            )

        try:
            data: Any = response.json()
        except Exception as json_err:
            raise TranslationUnavailableError(
                "Resposta inválida do serviço de tradução."
            ) from json_err

        detected_lang: str | None = None
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, str):
                return first, None
            if isinstance(first, list) and first:
                trans_text = str(first[0])
                if len(first) > 1 and isinstance(first[1], str):
                    detected_lang = first[1]
                return trans_text, detected_lang

        return text, None

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

        if target_lang in ("pt", "pt-BR") and self.is_text_already_portuguese(text):
            return TranslationResult(
                text=text,
                detected_source_language="PT",
                target_language=target_lang,
                provider=self.provider_name,
            )

        src = (source_language or "auto").lower()
        chunks = _chunk_text_google(text)

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            translated_chunks: list[str] = []
            detected_lang: str | None = None
            for idx, chunk in enumerate(chunks):
                if idx > 0:
                    await asyncio.sleep(0.1)
                part, d_lang = await self._fetch_single_segment(client, chunk, target_lang, src)
                translated_chunks.append(part)
                if d_lang:
                    detected_lang = d_lang

        combined = " ".join(translated_chunks) if len(chunks) > 1 else translated_chunks[0]

        return TranslationResult(
            text=combined,
            detected_source_language=(detected_lang or src).upper(),
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

        if target_lang in ("pt", "pt-BR") and self.is_text_already_portuguese(cleaned_title):
            return ArticleTranslationResult(
                translated_title=cleaned_title,
                translated_summary=summary,
                translated_content=content,
                detected_source_language="PT",
                target_language=target_lang,
                provider=self.provider_name,
            )

        src = (source_language or "auto").lower()

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            # 1. Translate Title
            translated_title, detected = await self._fetch_single_segment(
                client, cleaned_title, target_lang, src
            )

            # 2. Translate Summary (if present)
            translated_summary: str | None = None
            if summary and summary.strip():
                clean_summary = summary.strip()
                chunks = _chunk_text_google(clean_summary)
                parts: list[str] = []
                for c in chunks:
                    part, _ = await self._fetch_single_segment(client, c, target_lang, src)
                    parts.append(part)
                translated_summary = " ".join(parts) if len(parts) > 1 else parts[0]

            # 3. Translate Content (if present)
            translated_content: str | None = None
            if content and content.strip():
                clean_content = sanitize_text(content, max_length=4000)
                if clean_content:
                    chunks = _chunk_text_google(clean_content)
                    parts = []
                    for c in chunks[:4]:
                        part, _ = await self._fetch_single_segment(client, c, target_lang, src)
                        parts.append(part)
                    translated_content = "\n\n".join(parts) if len(parts) > 1 else parts[0]

        return ArticleTranslationResult(
            translated_title=translated_title,
            translated_summary=translated_summary,
            translated_content=translated_content,
            detected_source_language=(detected or src).upper(),
            target_language=target_lang,
            provider=self.provider_name,
        )
