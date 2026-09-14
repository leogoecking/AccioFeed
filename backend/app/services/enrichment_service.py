import asyncio
import logging
import time
import urllib.parse
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.extraction.extractor import ContentExtractor
from app.models.article import Article
from app.models.article_content import (
    ArticleContent,
    ContentLevel,
    ExtractionStatus,
)
from app.models.article_translation import ArticleTranslation
from app.models.base import utc_now
from app.translation.base import BaseTranslationProvider
from app.translation.factory import get_translation_provider

logger = logging.getLogger("enrichment")

PERMANENT_FAILURES = {
    "http_403",
    "paywall_or_restricted",
    "unsafe_url",
    "unsupported_content_type",
    "not_found",
}


class ArticleEnrichmentService:
    """Enriches newly persisted articles with safe full-text extraction

    and automatic timeline translation to PT-BR.
    """

    def __init__(
        self,
        db: AsyncSession,
        http_client: httpx.AsyncClient | None = None,
    ):
        self.db = db
        self.http_client = http_client
        self.extractor = ContentExtractor(
            timeout=float(settings.EXTRACTION_TIMEOUT_SECONDS)
            if hasattr(settings, "EXTRACTION_TIMEOUT_SECONDS")
            else 10.0,
            max_bytes=getattr(settings, "EXTRACTION_MAX_BYTES", 3 * 1024 * 1024),
            http_client=http_client,
        )

    async def enrich_article(self, article_id: UUID) -> dict[str, Any]:
        """Enriches an article idempotently:

        1. Full-text extraction (if content_level is not already full and not previously extracted).
        2. Language detection and automatic title/summary translation to PT-BR (if not yet translated).
        """
        stmt = (
            select(Article)
            .where(Article.id == article_id)
            .options(
                selectinload(Article.content_detail),
                selectinload(Article.translations),
            )
        )
        res = await self.db.execute(stmt)
        article = res.scalar_one_or_none()
        if not article:
            return {"status": "not_found", "article_id": str(article_id)}

        start_time = time.monotonic()
        logger.info("article_enrichment_started article_id=%s", article.id)

        extraction_result_type = "skipped"
        translation_result_type = "skipped"

        # ---------------------------------------------------------------------
        # 1. Full-Text Extraction Step
        # ---------------------------------------------------------------------
        content_detail = article.content_detail

        # If already marked as full in feed, record skipped with feed_content_sufficient
        if article.content_level == ContentLevel.FULL.value and not content_detail:
            content_detail = ArticleContent(
                article_id=article.id,
                extraction_status=ExtractionStatus.SKIPPED.value,
                failure_reason="feed_content_sufficient",
                extraction_method="rss_full",
            )
            self.db.add(content_detail)
            await self.db.flush()
            extraction_result_type = "feed_sufficient"

        elif (
            getattr(settings, "FULLTEXT_EXTRACTION_ENABLED", True)
            and article.url
            and article.content_level != ContentLevel.FULL.value
        ):
            # Check if previous extraction attempt exists
            should_attempt = True
            if content_detail:
                if content_detail.extraction_status in (
                    ExtractionStatus.SUCCESS.value,
                    ExtractionStatus.SKIPPED.value,
                ) or (
                    content_detail.extraction_status == ExtractionStatus.FAILED.value
                    and content_detail.failure_reason in PERMANENT_FAILURES
                ):
                    should_attempt = False

            if should_attempt:
                ext_start = time.monotonic()
                ext_res = await self.extractor.extract(article.url)
                ext_duration_ms = int((time.monotonic() - ext_start) * 1000)

                if ext_res.success and ext_res.content:
                    if not content_detail:
                        content_detail = ArticleContent(
                            article_id=article.id,
                            extracted_content=ext_res.content,
                            extraction_method=ext_res.method,
                            extraction_status=ExtractionStatus.SUCCESS.value,
                            extracted_at=utc_now(),
                        )
                        self.db.add(content_detail)
                    else:
                        content_detail.extracted_content = ext_res.content
                        content_detail.extraction_method = ext_res.method
                        content_detail.extraction_status = ExtractionStatus.SUCCESS.value
                        content_detail.failure_reason = None
                        content_detail.extracted_at = utc_now()

                    article.content_level = ContentLevel.FULL.value
                    extraction_result_type = "extracted"
                    logger.info(
                        "content_extraction_completed article_id=%s method=%s content_length=%d duration_ms=%d",
                        article.id,
                        ext_res.method,
                        len(ext_res.content),
                        ext_duration_ms,
                    )
                else:
                    reason = ext_res.error_reason or "extraction_failed"
                    if not content_detail:
                        content_detail = ArticleContent(
                            article_id=article.id,
                            extraction_status=ExtractionStatus.FAILED.value,
                            failure_reason=reason,
                            extraction_method="trafilatura",
                        )
                        self.db.add(content_detail)
                    else:
                        content_detail.extraction_status = ExtractionStatus.FAILED.value
                        content_detail.failure_reason = reason

                    extraction_result_type = f"failed:{reason}"
                    logger.info(
                        "content_extraction_failed article_id=%s reason=%s duration_ms=%d",
                        article.id,
                        reason,
                        ext_duration_ms,
                    )

                await self.db.flush()

        # ---------------------------------------------------------------------
        # 2. Language Detection & Automatic Timeline Translation (Title + Summary)
        # ---------------------------------------------------------------------
        if settings.TRANSLATION_ENABLED:
            existing_pt = next(
                (t for t in article.translations if t.language.lower() in ("pt", "pt-br", "pt_br")),
                None,
            )

            if not existing_pt:
                is_pt_lang = bool(
                    article.language and article.language.lower() in ("pt", "pt-br", "pt_br", "por")
                )
                is_pt_source = is_pt_lang or BaseTranslationProvider.is_text_already_portuguese(
                    article.title
                )

                if is_pt_source:
                    trans_record = ArticleTranslation(
                        article_id=article.id,
                        language="pt-BR",
                        translated_title=article.title,
                        translated_summary=article.summary,
                        translated_content=article.content,
                        provider="original_pt",
                        detected_source_language="PT",
                    )
                    self.db.add(trans_record)
                    article.translations.append(trans_record)
                    translation_result_type = "original_pt"
                else:
                    trans_start = time.monotonic()
                    try:
                        provider = get_translation_provider()
                        # Only translate title and summary during collection/enrichment!
                        result = await provider.translate_article(
                            title=article.title,
                            summary=article.summary,
                            content=None,
                            target_language="pt-BR",
                            source_language=article.language if article.language != "en" else None,
                        )
                        trans_duration_ms = int((time.monotonic() - trans_start) * 1000)

                        trans_record = ArticleTranslation(
                            article_id=article.id,
                            language="pt-BR",
                            translated_title=result.translated_title,
                            translated_summary=result.translated_summary,
                            translated_content=None,
                            provider=result.provider,
                            detected_source_language=result.detected_source_language,
                        )
                        self.db.add(trans_record)
                        article.translations.append(trans_record)
                        translation_result_type = "translated"
                        logger.info(
                            "translation_completed article_id=%s fields=title,summary provider=%s duration_ms=%d",
                            article.id,
                            result.provider,
                            trans_duration_ms,
                        )
                    except Exception as exc:
                        logger.warning(
                            "translation_failed article_id=%s reason=%s",
                            article.id,
                            exc.__class__.__name__,
                        )
                        translation_result_type = f"failed:{exc.__class__.__name__}"

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()

        total_duration_ms = int((time.monotonic() - start_time) * 1000)
        return {
            "status": "success",
            "article_id": str(article.id),
            "extraction": extraction_result_type,
            "translation": translation_result_type,
            "content_level": article.content_level,
            "duration_ms": total_duration_ms,
        }

    async def enrich_pending(
        self,
        limit: int = 20,
        max_concurrency: int = 2,
    ) -> list[dict[str, Any]]:
        """Finds articles needing enrichment and runs batch processing

        with politeness delays and concurrency constraints.
        """
        # Select articles that lack ArticleContent or lack pt-BR translation
        stmt = (
            select(Article.id, Article.url)
            .outerjoin(Article.content_detail)
            .outerjoin(Article.translations)
            .where(
                or_(
                    ArticleContent.id.is_(None),
                    ArticleTranslation.id.is_(None),
                )
            )
            .order_by(Article.published_at.desc())
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        candidates = list(res.all())

        if not candidates:
            return []

        logger.info("enrich_pending_started count=%d", len(candidates))
        semaphore = asyncio.Semaphore(max_concurrency)
        results = []
        domain_last_call: dict[str, float] = {}

        for article_id, article_url in candidates:
            # Politeness delay per domain (0.5s between requests to same domain)
            domain = "default"
            if article_url:
                try:
                    domain = urllib.parse.urlparse(article_url).netloc.lower()
                except Exception:
                    pass

            now = time.monotonic()
            last_call = domain_last_call.get(domain, 0.0)
            elapsed = now - last_call
            if elapsed < 0.5:
                await asyncio.sleep(0.5 - elapsed)
            domain_last_call[domain] = time.monotonic()

            async with semaphore:
                r = await self.enrich_article(article_id)
                results.append(r)

        logger.info("enrich_pending_completed processed=%d", len(results))
        return results
