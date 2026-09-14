from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.extraction.extractor import ExtractionResult
from app.models.article import Article
from app.models.article_content import ContentLevel
from app.models.source import Source
from app.services.enrichment_service import ArticleEnrichmentService
from app.translation.base import ArticleTranslationResult


@pytest.fixture
async def sample_english_source(db_session: AsyncSession) -> Source:
    source = Source(
        name="Tech Radar US",
        slug="tech-radar-us",
        type="rss",
        base_url="https://techradar.com",
        feed_url="https://techradar.com/feed",
        default_category="technology",
        poll_interval_minutes=15,
        is_active=True,
    )
    db_session.add(source)
    await db_session.commit()
    await db_session.refresh(source)
    return source


@pytest.fixture
async def sample_english_article(
    db_session: AsyncSession, sample_english_source: Source
) -> Article:
    article = Article(
        source_id=sample_english_source.id,
        external_id="ext-eng-100",
        title="Nvidia Unveils Next-Generation AI Superchips",
        url="https://techradar.com/news/nvidia-superchips",
        canonical_url="https://techradar.com/news/nvidia-superchips",
        author="Jane Doe",
        summary="Nvidia has officially introduced its newest GPU architecture designed for hyperscalers.",
        content=None,  # Not full content from feed
        content_level=ContentLevel.PARTIAL.value,
        published_at=datetime.now(UTC),
        language="en",
        category="hardware",
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)
    return article


@pytest.fixture
async def sample_portuguese_article(
    db_session: AsyncSession, sample_english_source: Source
) -> Article:
    article = Article(
        source_id=sample_english_source.id,
        external_id="ext-pt-200",
        title="Governo brasileiro anuncia incentivos para inteligência artificial",
        url="https://techradar.com/noticias/governo-ia",
        canonical_url="https://techradar.com/noticias/governo-ia",
        author="Carlos Silva",
        summary="Nova portaria prevê investimentos para capacitação de desenvolvedores no Brasil.",
        content="Conteúdo completo da notícia em português com diversos parágrafos para leitura.",
        content_level=ContentLevel.FULL.value,
        published_at=datetime.now(UTC),
        language="pt",
        category="technology",
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)
    return article


@pytest.mark.asyncio
async def test_enrichment_english_article_extracts_and_translates_title_summary(
    db_session: AsyncSession,
    sample_english_article: Article,
):
    """Verifies that an English article gets extracted and has title+summary translated automatically."""
    article_id = sample_english_article.id

    mock_extract_result = ExtractionResult(
        title="Nvidia Unveils Next-Generation AI Superchips",
        author="Jane Doe",
        content="Detailed editorial text extracted by Trafilatura about the new Blackwell architecture and performance. "
        * 5,
        success=True,
        method="trafilatura",
    )

    mock_trans_result = ArticleTranslationResult(
        translated_title="Nvidia Revela Superchips de IA de Próxima Geração",
        translated_summary="A Nvidia apresentou oficialmente sua mais nova arquitetura de GPU projetada para hiperescaladores.",
        translated_content=None,
        detected_source_language="EN",
        target_language="PT-BR",
        provider="deepl",
    )

    mock_provider = AsyncMock()
    mock_provider.provider_name = "deepl"
    mock_provider.translate_article = AsyncMock(return_value=mock_trans_result)

    with (
        patch(
            "app.extraction.extractor.ContentExtractor.extract",
            AsyncMock(return_value=mock_extract_result),
        ),
        patch(
            "app.services.enrichment_service.get_translation_provider", return_value=mock_provider
        ),
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch.object(settings, "FULLTEXT_EXTRACTION_ENABLED", True),
    ):
        service = ArticleEnrichmentService(db_session)
        res = await service.enrich_article(article_id)

        assert res["status"] == "success"
        assert res["extraction"] == "extracted"
        assert res["translation"] == "translated"
        assert res["content_level"] == "full"

    # Refresh and assert article state
    await db_session.refresh(sample_english_article)
    assert sample_english_article.content_level == "full"
    assert sample_english_article.content_detail is not None
    assert sample_english_article.content_detail.extraction_status == "success"
    assert "Blackwell architecture" in sample_english_article.content_detail.extracted_content

    assert len(sample_english_article.translations) == 1
    tr = sample_english_article.translations[0]
    assert tr.translated_title == "Nvidia Revela Superchips de IA de Próxima Geração"
    assert tr.translated_summary is not None
    assert tr.translated_content is None  # Full content translation is deferred to Reader!


@pytest.mark.asyncio
async def test_enrichment_portuguese_article_skips_external_translation(
    db_session: AsyncSession,
    sample_portuguese_article: Article,
):
    """Articles originally in Portuguese must NOT call external translation provider."""
    mock_provider = AsyncMock()

    with (
        patch(
            "app.services.enrichment_service.get_translation_provider", return_value=mock_provider
        ),
        patch.object(settings, "TRANSLATION_ENABLED", True),
    ):
        service = ArticleEnrichmentService(db_session)
        res = await service.enrich_article(sample_portuguese_article.id)

        assert res["status"] == "success"
        assert res["translation"] == "original_pt"
        mock_provider.translate_article.assert_not_called()


@pytest.mark.asyncio
async def test_timeline_returns_ptbr_display_fields_by_default(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_english_article: Article,
):
    """Timeline endpoint (/api/v1/articles) must return display_title and display_summary preferring PT-BR."""
    article_id = sample_english_article.id

    mock_trans_result = ArticleTranslationResult(
        translated_title="Nvidia Revela Superchips de IA de Próxima Geração",
        translated_summary="Resumo em português.",
        translated_content=None,
        target_language="PT-BR",
        provider="deepl",
    )

    mock_provider = AsyncMock()
    mock_provider.provider_name = "deepl"
    mock_provider.translate_article = AsyncMock(return_value=mock_trans_result)

    with (
        patch(
            "app.services.enrichment_service.get_translation_provider", return_value=mock_provider
        ),
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch.object(settings, "FULLTEXT_EXTRACTION_ENABLED", False),
    ):
        service = ArticleEnrichmentService(db_session)
        await service.enrich_article(article_id)

    # Query timeline via API
    resp = await async_client.get("/api/v1/articles")
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    target = next((item for item in items if item["id"] == str(article_id)), None)

    assert target is not None
    assert target["display_title"] == "Nvidia Revela Superchips de IA de Próxima Geração"
    assert (
        target["title"] == "Nvidia Revela Superchips de IA de Próxima Geração"
    )  # Default title is display title
    assert target["original_title"] == "Nvidia Unveils Next-Generation AI Superchips"
    assert target["translation_available"] is True
    assert target["content_level"] in ("full", "partial")


@pytest.mark.asyncio
async def test_timeline_with_extracted_content_detail_does_not_fail_on_deferred_fields(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_english_article: Article,
):
    """Articles with extracted ArticleContent must serialize cleanly in timeline despite defer() without MissingGreenlet."""
    from app.models.article_content import ArticleContent

    content = ArticleContent(
        article_id=sample_english_article.id,
        extracted_content="Full extracted article text containing comprehensive details.",
        extraction_status="success",
        extraction_method="trafilatura",
    )
    db_session.add(content)
    sample_english_article.content_detail = content
    sample_english_article.content_level = "full"
    await db_session.commit()

    # Timeline list endpoint (with deferred extracted_content)
    resp = await async_client.get("/api/v1/articles")
    assert resp.status_code == 200
    data = resp.json()
    item = next((it for it in data["items"] if it["id"] == str(sample_english_article.id)), None)
    assert item is not None
    assert item["content_level"] == "full"
    assert item["extracted_content"] in (
        None,
        "Full extracted article text containing comprehensive details.",
    )

    # Detail endpoint (loads full extracted_content)
    detail_resp = await async_client.get(f"/api/v1/articles/{sample_english_article.id}")
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert (
        detail_data["extracted_content"]
        == "Full extracted article text containing comprehensive details."
    )


@pytest.mark.asyncio
async def test_reader_full_content_translation_on_demand_and_caching(
    async_client: AsyncClient,
    db_session: AsyncSession,
    sample_english_article: Article,
):
    """When reader requests full-text translation with force_full=True, it translates content and caches it."""
    sample_english_article.content = (
        "Detailed article content discussing modern system design and technology."
    )
    await db_session.commit()
    await db_session.refresh(sample_english_article)

    article_id = str(sample_english_article.id)

    # 1. First enrich (creates title+summary translation with translated_content=None)
    mock_trans_initial = ArticleTranslationResult(
        translated_title="Título Traduzido",
        translated_summary="Resumo Traduzido",
        translated_content=None,
        target_language="PT-BR",
        provider="deepl",
    )
    mock_provider = AsyncMock()
    mock_provider.provider_name = "deepl"
    mock_provider.translate_article = AsyncMock(return_value=mock_trans_initial)

    with (
        patch(
            "app.services.enrichment_service.get_translation_provider", return_value=mock_provider
        ),
        patch.object(settings, "FULLTEXT_EXTRACTION_ENABLED", False),
    ):
        service = ArticleEnrichmentService(db_session)
        await service.enrich_article(sample_english_article.id)

    # 2. Reader requests translation with force_full=True
    mock_trans_full = ArticleTranslationResult(
        translated_title="Título Traduzido",
        translated_summary="Resumo Traduzido",
        translated_content="Texto integral do artigo traduzido com sucesso para leitura no Reader.",
        target_language="PT-BR",
        provider="deepl",
    )
    mock_provider.translate_article = AsyncMock(return_value=mock_trans_full)

    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch(
            "app.services.translation_service.get_translation_provider", return_value=mock_provider
        ),
    ):
        resp = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR", "force_full": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert (
            data["translated_content"]
            == "Texto integral do artigo traduzido com sucesso para leitura no Reader."
        )
        assert mock_provider.translate_article.call_count == 1

        # 3. Subsequent reader opening: cache hit, provider NOT called again!
        mock_provider.translate_article.reset_mock()
        resp2 = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR", "force_full": True},
        )
        assert resp2.status_code == 200
        assert (
            resp2.json()["translated_content"]
            == "Texto integral do artigo traduzido com sucesso para leitura no Reader."
        )
        mock_provider.translate_article.assert_not_called()
