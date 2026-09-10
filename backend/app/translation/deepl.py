import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.translation.base import (
    ArticleTranslationResult,
    BaseTranslationProvider,
    TranslationAuthError,
    TranslationConfigError,
    TranslationError,
    TranslationQuotaError,
    TranslationResult,
    TranslationUnavailableError,
)

logger = logging.getLogger(__name__)


class DeepLProvider(BaseTranslationProvider):
    """DeepL translation provider implementation supporting Free and Pro API keys."""

    def __init__(
        self,
        api_key: str | None = None,
        api_url: str | None = None,
        timeout_seconds: int | None = None,
    ):
        self.api_key = (api_key or settings.TRANSLATION_API_KEY or "").strip()
        self.timeout_seconds = timeout_seconds or settings.TRANSLATION_TIMEOUT_SECONDS

        if api_url:
            self.api_url = api_url.strip()
        elif settings.TRANSLATION_DEEPL_API_URL:
            self.api_url = settings.TRANSLATION_DEEPL_API_URL.strip()
        elif self.api_key.endswith(":fx"):
            self.api_url = "https://api-free.deepl.com/v2/translate"
        else:
            self.api_url = "https://api.deepl.com/v2/translate"

    @property
    def provider_name(self) -> str:
        return "deepl"

    def _normalize_target_language(self, lang: str) -> str:
        """Normalize target language for DeepL API.

        DeepL requires uppercase 'PT-BR' for Brazilian Portuguese.
        """
        cleaned = lang.strip().upper()
        if cleaned in ("PT", "PT-BR", "PT_BR"):
            return "PT-BR"
        if cleaned in ("PT-PT", "PT_PT"):
            return "PT-PT"
        if cleaned in ("EN", "EN-US", "EN_US"):
            return "EN-US"
        if cleaned in ("EN-GB", "EN_GB"):
            return "EN-GB"
        return cleaned

    def _validate_configuration(self) -> None:
        if not self.api_key:
            raise TranslationConfigError(
                "Chave de API do DeepL (TRANSLATION_API_KEY) não configurada."
            )

    async def _post_with_retry(
        self,
        payload: dict[str, Any],
        max_retries: int = 2,
    ) -> dict[str, Any]:
        """Execute POST request to DeepL API with retry on transient failures."""
        self._validate_configuration()

        headers = {
            "Authorization": f"DeepL-Auth-Key {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "TechNewsHub-Translator/1.0",
        }

        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    response = await client.post(
                        self.api_url,
                        json=payload,
                        headers=headers,
                    )

                if response.status_code == 200:
                    try:
                        return response.json()
                    except Exception as json_err:
                        raise TranslationUnavailableError(
                            "Resposta do serviço de tradução em formato inválido."
                        ) from json_err

                # Non-retriable auth errors
                if response.status_code in (401, 403):
                    logger.warning("DeepL authentication failed: status=%s", response.status_code)
                    raise TranslationAuthError(
                        "Chave de API do DeepL inválida ou sem permissão de acesso."
                    )

                # Non-retriable quota errors
                if response.status_code == 456:
                    logger.warning("DeepL quota exceeded (HTTP 456)")
                    raise TranslationQuotaError("Cota mensal de tradução do DeepL foi excedida.")

                # Rate limit (429)
                if response.status_code == 429:
                    logger.warning("DeepL rate limited (HTTP 429)")
                    raise TranslationQuotaError(
                        "Muitas requisições ao provedor de tradução. Tente novamente em instantes."
                    )

                # 4xx client errors
                if 400 <= response.status_code < 500:
                    logger.warning(
                        "DeepL client error: status=%s body=%s",
                        response.status_code,
                        response.text[:200],
                    )
                    raise TranslationError(
                        f"Requisição de tradução inválida (HTTP {response.status_code})."
                    )

                # 5xx server errors - can retry
                if attempt < max_retries:
                    backoff = 0.5 * (2**attempt)
                    logger.info(
                        "DeepL transient error (HTTP %s). Retrying in %.1fs...",
                        response.status_code,
                        backoff,
                    )
                    await asyncio.sleep(backoff)
                    continue

                raise TranslationUnavailableError(
                    "Serviço de tradução indisponível no momento. Tente novamente mais tarde."
                )

            except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as net_err:
                last_error = net_err
                if attempt < max_retries:
                    backoff = 0.5 * (2**attempt)
                    logger.info(
                        "DeepL network error (%s). Retrying in %.1fs...",
                        type(net_err).__name__,
                        backoff,
                    )
                    await asyncio.sleep(backoff)
                    continue
                break
            except (TranslationError, TranslationAuthError, TranslationQuotaError):
                raise

        raise TranslationUnavailableError(
            "Não foi possível conectar ao serviço de tradução (timeout ou falha de rede)."
        ) from last_error

    async def translate(
        self,
        text: str,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        """Translate a single text string."""
        if not text or not text.strip():
            return TranslationResult(
                text=text,
                detected_source_language=source_language,
                target_language=target_language,
                provider=self.provider_name,
            )

        target_lang = self._normalize_target_language(target_language)

        # Check if already Portuguese
        if target_lang == "PT-BR" and self.is_text_already_portuguese(text):
            return TranslationResult(
                text=text,
                detected_source_language="PT",
                target_language=target_lang,
                provider=self.provider_name,
            )

        payload: dict[str, Any] = {
            "text": [text],
            "target_lang": target_lang,
        }
        if source_language:
            payload["source_lang"] = source_language.upper()

        data = await self._post_with_retry(payload)
        translations = data.get("translations", [])
        if not translations:
            raise TranslationUnavailableError("Nenhuma tradução retornada pelo provedor.")

        item = translations[0]
        return TranslationResult(
            text=item.get("text", text),
            detected_source_language=item.get("detected_source_language"),
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
        """Translate article fields efficiently in a single batch request."""
        target_lang = self._normalize_target_language(target_language)

        # 1. Check if title is already in target language (Portuguese)
        if target_lang == "PT-BR" and self.is_text_already_portuguese(title):
            return ArticleTranslationResult(
                translated_title=title,
                translated_summary=summary,
                translated_content=content,
                detected_source_language="PT",
                target_language=target_lang,
                provider=self.provider_name,
            )

        # 2. Build list of texts to translate in one batch
        texts_to_translate: list[str] = [title]
        has_summary = bool(summary and summary.strip())
        if has_summary and summary is not None:
            texts_to_translate.append(summary)

        # 3. Handle content: for safety and length limits, translate content if text is reasonable
        has_content = bool(content and content.strip())
        if has_content and content is not None and len(content) <= 5000:
            texts_to_translate.append(content)
        else:
            has_content = False

        payload: dict[str, Any] = {
            "text": texts_to_translate,
            "target_lang": target_lang,
        }
        if source_language:
            payload["source_lang"] = source_language.upper()

        data = await self._post_with_retry(payload)
        translations = data.get("translations", [])

        if not translations:
            raise TranslationUnavailableError("Nenhuma tradução retornada pelo provedor.")

        translated_title = translations[0].get("text", title)
        detected_source_lang = translations[0].get("detected_source_language")

        translated_summary: str | None = None
        current_idx = 1
        if has_summary and len(translations) > current_idx:
            translated_summary = translations[current_idx].get("text")
            current_idx += 1
        elif summary:
            translated_summary = summary

        translated_content: str | None = None
        if has_content and len(translations) > current_idx:
            translated_content = translations[current_idx].get("text")
        elif content:
            translated_content = content

        return ArticleTranslationResult(
            translated_title=translated_title,
            translated_summary=translated_summary,
            translated_content=translated_content,
            detected_source_language=detected_source_lang,
            target_language=target_lang,
            provider=self.provider_name,
        )
