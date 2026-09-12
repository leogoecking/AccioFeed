import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.source_repository import SourceRepository
from app.services.article_service import ArticleService
from app.sources.base import NormalizedArticle
from app.translation.base import (
    ArticleTranslationResult,
    TranslationAuthError,
    TranslationQuotaError,
)


@pytest_asyncio.fixture(scope="function")
async def sample_article(db_session: AsyncSession):
    source_repo = SourceRepository(db_session)
    source = await source_repo.get_or_create(
        slug="tech-crunch",
        name="TechCrunch",
        type="rss",
        base_url="https://techcrunch.com",
    )

    service = ArticleService(db_session)
    article, _ = await service.ingest_normalized_article(
        source_id=source.id,
        normalized=NormalizedArticle(
            external_id="tc-1001",
            title="Breakthrough in Quantum Computing Architecture",
            summary="Scientists achieve milestone in error correction algorithms.",
            content="<p>Full research findings released today by lab team.</p>",
            url="https://techcrunch.com/quantum-breakthrough",
            published_at=datetime.now(UTC),
            category="science",
        ),
    )
    return article


@pytest.mark.asyncio
async def test_translation_flow_and_cache(
    async_client: AsyncClient,
    sample_article,
):
    article_id = str(sample_article.id)

    # 1. Before translation: GET returns 404
    get_res_before = await async_client.get(
        f"/api/v1/articles/{article_id}/translations?language=pt-BR"
    )
    assert get_res_before.status_code == 404

    # 2. Mock provider response
    mock_result = ArticleTranslationResult(
        translated_title="Avanço na Arquitetura de Computação Quântica",
        translated_summary="Cientistas alcançam marco em algoritmos de correção de erros.",
        translated_content="<p>Resultados completos da pesquisa divulgados hoje pela equipe do laboratório.</p>",
        detected_source_language="EN",
        target_language="PT-BR",
        provider="deepl",
    )

    mock_provider = AsyncMock()
    mock_provider.provider_name = "deepl"
    mock_provider.translate_article.return_value = mock_result

    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch(
            "app.services.translation_service.get_translation_provider",
            return_value=mock_provider,
        ),
    ):
        # 3. First request: translates and persists
        post_res = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR"},
        )
        assert post_res.status_code == 200
        data = post_res.json()
        assert data["translated_title"] == "Avanço na Arquitetura de Computação Quântica"
        assert (
            data["translated_summary"]
            == "Cientistas alcançam marco em algoritmos de correção de erros."
        )
        assert data["language"] == "pt-BR"
        assert data["provider"] == "deepl"
        assert mock_provider.translate_article.call_count == 1

        # 4. Second request: should hit cache and NOT call provider again
        post_res_cached = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR"},
        )
        assert post_res_cached.status_code == 200
        cached_data = post_res_cached.json()
        assert cached_data["translated_title"] == "Avanço na Arquitetura de Computação Quântica"
        assert mock_provider.translate_article.call_count == 1  # Still 1!

        # 5. GET endpoint now returns the cached translation
        get_res_after = await async_client.get(
            f"/api/v1/articles/{article_id}/translations?language=pt-BR"
        )
        assert get_res_after.status_code == 200
        assert (
            get_res_after.json()["translated_title"]
            == "Avanço na Arquitetura de Computação Quântica"
        )


@pytest.mark.asyncio
async def test_translation_portuguese_article_skips_provider(
    async_client: AsyncClient,
    db_session: AsyncSession,
):
    source_repo = SourceRepository(db_session)
    source = await source_repo.get_or_create(
        slug="manual-do-usuario",
        name="Manual do Usuário",
        type="rss",
        base_url="https://manualdousuario.net",
    )

    service = ArticleService(db_session)
    pt_article, _ = await service.ingest_normalized_article(
        source_id=source.id,
        normalized=NormalizedArticle(
            external_id="mdu-2001",
            title="Novo aplicativo brasileiro para leitura de notícias e podcasts",
            summary="Uma análise sobre a nova ferramenta criada para desenvolvedores.",
            url="https://manualdousuario.net/novo-app",
            published_at=datetime.now(UTC),
            category="dev",
        ),
    )
    article_id = str(pt_article.id)

    mock_provider = AsyncMock()
    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch(
            "app.services.translation_service.get_translation_provider",
            return_value=mock_provider,
        ),
    ):
        res = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR"},
        )
        assert res.status_code == 200
        data = res.json()
        assert (
            data["translated_title"]
            == "Novo aplicativo brasileiro para leitura de notícias e podcasts"
        )
        assert data["provider"] == "original_pt"
        mock_provider.translate_article.assert_not_called()


@pytest.mark.asyncio
async def test_translation_disabled_returns_503(
    async_client: AsyncClient,
    sample_article,
):
    article_id = str(sample_article.id)
    with patch.object(settings, "TRANSLATION_ENABLED", False):
        res = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR"},
        )
        assert res.status_code == 503
        assert "desativado no momento" in res.json()["detail"]


@pytest.mark.asyncio
async def test_translation_auth_error_returns_502(
    async_client: AsyncClient,
    sample_article,
):
    article_id = str(sample_article.id)
    mock_provider = AsyncMock()
    mock_provider.provider_name = "deepl"
    mock_provider.translate_article.side_effect = TranslationAuthError(
        "Chave de API do DeepL inválida."
    )

    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch(
            "app.services.translation_service.get_translation_provider",
            return_value=mock_provider,
        ),
    ):
        res = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR"},
        )
        assert res.status_code == 502
        assert "Chave de API do DeepL inválida" in res.json()["detail"]

        # Original article remains accessible
        art_res = await async_client.get(f"/api/v1/articles/{article_id}")
        assert art_res.status_code == 200
        assert art_res.json()["title"] == "Breakthrough in Quantum Computing Architecture"


@pytest.mark.asyncio
async def test_translation_quota_error_returns_429(
    async_client: AsyncClient,
    sample_article,
):
    article_id = str(sample_article.id)
    mock_provider = AsyncMock()
    mock_provider.provider_name = "deepl"
    mock_provider.translate_article.side_effect = TranslationQuotaError(
        "Cota mensal de tradução excedida."
    )

    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch(
            "app.services.translation_service.get_translation_provider",
            return_value=mock_provider,
        ),
    ):
        res = await async_client.post(
            f"/api/v1/articles/{article_id}/translations",
            json={"language": "pt-BR"},
        )
        assert res.status_code == 429
        assert "Cota mensal de tradução excedida" in res.json()["detail"]


@pytest.mark.asyncio
async def test_concurrent_translations_single_external_call(
    async_client: AsyncClient,
    sample_article,
):
    article_id = str(sample_article.id)

    mock_result = ArticleTranslationResult(
        translated_title="Título Traduzido com Sucesso",
        translated_summary="Resumo Traduzido com Sucesso",
        translated_content=None,
        detected_source_language="EN",
        target_language="PT-BR",
        provider="deepl",
    )

    async def slow_translate(*_args, **_kwargs):
        await asyncio.sleep(0.05)
        return mock_result

    mock_provider = AsyncMock()
    mock_provider.provider_name = "deepl"
    mock_provider.translate_article.side_effect = slow_translate

    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch(
            "app.services.translation_service.get_translation_provider",
            return_value=mock_provider,
        ),
    ):
        # 5 simultaneous requests for the same article
        tasks = [
            async_client.post(
                f"/api/v1/articles/{article_id}/translations",
                json={"language": "pt-BR"},
            )
            for _ in range(5)
        ]
        responses = await asyncio.gather(*tasks)

        for resp in responses:
            assert resp.status_code == 200
            assert resp.json()["translated_title"] == "Título Traduzido com Sucesso"

        # Provider must have been called exactly once!
        assert mock_provider.translate_article.call_count == 1


@pytest.mark.asyncio
async def test_translation_service_none_language():
    import uuid
    from unittest.mock import MagicMock

    from app.services.translation_service import TranslationService

    mock_session = AsyncMock()
    service = TranslationService(mock_session)

    mock_article = MagicMock()
    mock_article.language = None
    mock_article.title = "Test Article Without Language"
    mock_article.summary = "Summary"
    mock_article.content = None

    service.article_repo = AsyncMock()
    service.article_repo.get_by_id.return_value = mock_article
    service.repo = AsyncMock()
    service.repo.get_by_article_and_language.return_value = None
    service.repo.create_translation.return_value = MagicMock()

    mock_provider = AsyncMock()
    mock_provider.provider_name = "mock"
    mock_provider.translate_article.return_value = ArticleTranslationResult(
        translated_title="Título Teste",
        translated_summary="Resumo",
        translated_content=None,
        detected_source_language="EN",
        target_language="pt-BR",
        provider="mock",
    )

    with patch(
        "app.services.translation_service.get_translation_provider",
        return_value=mock_provider,
    ):
        result = await service.translate_article(uuid.uuid4(), "pt-BR")
        assert result is not None
        mock_provider.translate_article.assert_called_once()


@pytest.mark.asyncio
async def test_client_provided_translation_persists_in_cache(
    async_client: AsyncClient,
    sample_article,
):
    article_id = str(sample_article.id)
    payload = {
        "language": "pt-BR",
        "translated_title": "Título traduzido no cliente",
        "translated_summary": "Resumo traduzido no cliente",
        "provider": "mymemory_client",
        "detected_source_language": "EN",
    }

    res = await async_client.post(
        f"/api/v1/articles/{article_id}/translations",
        json=payload,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["translated_title"] == "Título traduzido no cliente"
    assert data["translated_summary"] == "Resumo traduzido no cliente"
    assert data["provider"] == "mymemory_client"

    # Subsequent GET returns the cached translation
    get_res = await async_client.get(f"/api/v1/articles/{article_id}/translations?language=pt-BR")
    assert get_res.status_code == 200
    assert get_res.json()["translated_title"] == "Título traduzido no cliente"
