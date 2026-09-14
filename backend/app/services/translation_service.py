import asyncio
import logging
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article_translation import ArticleTranslation
from app.repositories.article_repository import ArticleRepository
from app.repositories.translation_repository import TranslationRepository
from app.translation.base import (
    BaseTranslationProvider,
    TranslationError,
)
from app.translation.factory import get_translation_provider

logger = logging.getLogger(__name__)

# Keyed in-memory locks to prevent concurrent duplicate translation requests
_translation_locks: dict[str, asyncio.Lock] = {}
_locks_guard = asyncio.Lock()


async def _get_lock(key: str) -> asyncio.Lock:
    async with _locks_guard:
        if key not in _translation_locks:
            if len(_translation_locks) > 500:
                unlocked_keys = [
                    k for k, item_lock in _translation_locks.items() if not item_lock.locked()
                ]
                for k in unlocked_keys:
                    del _translation_locks[k]
            _translation_locks[key] = asyncio.Lock()
        return _translation_locks[key]


class TranslationService:
    """Service managing article translations, caching, concurrency, and provider invocation."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = TranslationRepository(session)
        self.article_repo = ArticleRepository(session)

    def _normalize_language(self, lang: str) -> str:
        cleaned = lang.strip()
        if cleaned.lower() in ("pt", "pt-br", "pt_br"):
            return "pt-BR"
        return cleaned

    async def get_translation(
        self,
        article_id: UUID,
        language: str = "pt-BR",
    ) -> ArticleTranslation | None:
        """Fetch cached translation if it exists."""
        norm_lang = self._normalize_language(language)
        cached = await self.repo.get_by_article_and_language(article_id, norm_lang)
        if not cached:
            return None

        # If this is a bogus untranslated echo record, do not return it as a valid translation
        if cached.provider != "original_pt":
            article = await self.article_repo.get_by_id(article_id)
            if article and not (article.language and article.language.lower().startswith("pt")):
                if not BaseTranslationProvider.is_text_already_portuguese(article.title):
                    if (
                        cached.translated_title.strip().lower() == article.title.strip().lower()
                        and not cached.translated_content
                        and len(article.title.split()) >= 3
                    ):
                        return None
        return cached

    async def translate_article(
        self,
        article_id: UUID,
        language: str = "pt-BR",
        force_full: bool = False,
    ) -> ArticleTranslation:
        """Translate article on-demand.

        1. Checks database cache.
        2. Acquires in-memory lock to avoid duplicate external calls on concurrent requests.
        3. Checks if article is already in Portuguese (avoids external API call).
        4. Calls configured provider (e.g. DeepL).
        5. Persists and returns cached translation.
        """
        norm_lang = self._normalize_language(language)
        lock_key = f"{article_id}:{norm_lang}"
        lock = await _get_lock(lock_key)

        async with lock:
            # 1. Fetch article first to determine effective content
            article = await self.article_repo.get_by_id(article_id)
            if not article:
                raise ValueError("Artigo não encontrado.")

            effective_content: str | None = None
            if article.content_detail and article.content_detail.extracted_content:
                effective_content = article.content_detail.extracted_content
            elif article.content:
                effective_content = article.content

            # 2. Check cache under lock
            cached = await self.repo.get_by_article_and_language(article_id, norm_lang)
            if cached:
                is_pt_source = bool(
                    article.language and article.language.lower() in ("pt", "pt-br", "pt_br", "por")
                ) or BaseTranslationProvider.is_text_already_portuguese(article.title)

                is_bogus_echo = (
                    not is_pt_source
                    and cached.provider != "original_pt"
                    and cached.translated_title.strip().lower() == article.title.strip().lower()
                    and len(article.title.split()) >= 3
                )

                if is_bogus_echo:
                    logger.info(
                        "Cached translation for article %s is an untranslated echo (%s). Re-translating via active provider.",
                        article_id,
                        cached.provider,
                    )
                    provider = get_translation_provider()
                    try:
                        result = await provider.translate_article(
                            title=article.title,
                            summary=article.summary,
                            content=effective_content
                            if (force_full or cached.translated_content)
                            else None,
                            target_language=norm_lang,
                            source_language=article.language if article.language != "en" else None,
                        )
                        cached.translated_title = result.translated_title
                        cached.translated_summary = result.translated_summary
                        if result.translated_content:
                            cached.translated_content = result.translated_content
                        cached.provider = result.provider
                        cached.detected_source_language = result.detected_source_language
                        await self.session.commit()
                        await self.session.refresh(cached)
                        return cached
                    except Exception as exc:
                        logger.warning(
                            "Auto-heal translation failed for article %s: %s",
                            article_id,
                            exc,
                        )
                        # Continue to see if we can fulfill the request
                else:
                    # If force_full is not requested, or cache already has full content, or article has no content:
                    if not force_full or cached.translated_content or not effective_content:
                        logger.debug(
                            "Translation cache hit for article %s (%s)", article_id, norm_lang
                        )
                        return cached

                    # If cached record only had title/summary translated, complete it now with full content!
                    provider = get_translation_provider()
                    logger.info(
                        "Completing on-demand full content translation for article %s via %s",
                        article_id,
                        provider.provider_name,
                    )
                    try:
                        result = await provider.translate_article(
                            title=article.title,
                            summary=article.summary,
                            content=effective_content,
                            target_language=norm_lang,
                            source_language=article.language if article.language != "en" else None,
                        )
                        updated = await self.repo.update_translation_content(
                            translation_id=cached.id,
                            translated_content=result.translated_content or "",
                            provider=result.provider,
                        )
                        await self.session.commit()
                        return updated or cached
                    except Exception as exc:
                        logger.warning(
                            "Full content translation failed for article %s: %s",
                            article_id,
                            exc,
                        )
                        return cached

            # 3. Check if article is already in Portuguese
            is_pt_lang = bool(
                article.language and article.language.lower() in ("pt", "pt-br", "pt_br", "por")
            )
            is_pt_source = is_pt_lang or BaseTranslationProvider.is_text_already_portuguese(
                article.title
            )

            if norm_lang == "pt-BR" and is_pt_source:
                logger.info(
                    "Article %s is already in Portuguese. Skipping external translation.",
                    article_id,
                )
                try:
                    translation = await self.repo.create_translation(
                        article_id=article_id,
                        language=norm_lang,
                        translated_title=article.title,
                        translated_summary=article.summary,
                        translated_content=effective_content,
                        provider="original_pt",
                        detected_source_language="PT",
                    )
                    await self.session.commit()
                    return translation
                except IntegrityError:
                    await self.session.rollback()
                    existing = await self.repo.get_by_article_and_language(article_id, norm_lang)
                    if existing:
                        return existing
                    raise

            # 4. Invoke translation provider for title, summary, and full content
            provider = get_translation_provider()
            logger.info(
                "Requesting on-demand translation for article %s to %s via %s",
                article_id,
                norm_lang,
                provider.provider_name,
            )

            try:
                result = await provider.translate_article(
                    title=article.title,
                    summary=article.summary,
                    content=effective_content,
                    target_language=norm_lang,
                    source_language=article.language if article.language != "en" else None,
                )
            except TranslationError:
                raise
            except Exception as exc:
                logger.error(
                    "Unexpected error during translation of article %s: %s",
                    article_id,
                    exc,
                )
                raise TranslationError(
                    "Não foi possível traduzir esta notícia agora. Você ainda pode visualizar o conteúdo original."
                ) from exc

            # 5. Persist translation
            try:
                translation = await self.repo.create_translation(
                    article_id=article_id,
                    language=norm_lang,
                    translated_title=result.translated_title,
                    translated_summary=result.translated_summary,
                    translated_content=result.translated_content,
                    provider=result.provider,
                    detected_source_language=result.detected_source_language,
                )
                await self.session.commit()
                return translation
            except IntegrityError:
                await self.session.rollback()
                existing = await self.repo.get_by_article_and_language(article_id, norm_lang)
                if existing:
                    return existing
                raise
