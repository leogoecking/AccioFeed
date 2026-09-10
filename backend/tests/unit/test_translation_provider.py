from unittest.mock import patch

import httpx
import pytest

from app.core.config import settings
from app.translation.base import (
    BaseTranslationProvider,
    TranslationAuthError,
    TranslationConfigError,
    TranslationDisabledError,
    TranslationQuotaError,
    TranslationUnavailableError,
)
from app.translation.deepl import DeepLProvider
from app.translation.factory import get_translation_provider


def test_is_text_already_portuguese():
    # Portuguese tech titles
    assert BaseTranslationProvider.is_text_already_portuguese(
        "Novo modelo de inteligência artificial é lançado no Brasil"
    )
    assert BaseTranslationProvider.is_text_already_portuguese(
        "Governo anuncia regras para segurança digital e proteção de dados"
    )
    # English titles should not trigger
    assert not BaseTranslationProvider.is_text_already_portuguese(
        "OpenAI announces new reasoning capabilities for autonomous agents"
    )
    assert not BaseTranslationProvider.is_text_already_portuguese(
        "Linux kernel 6.14 improves performance on AMD and Intel processors"
    )
    assert not BaseTranslationProvider.is_text_already_portuguese(
        "GitHub.com launches new CLI tool for developers"
    )
    assert not BaseTranslationProvider.is_text_already_portuguese(
        "Amazon.com reports high revenue growth in cloud division"
    )


@pytest.mark.asyncio
async def test_deepl_missing_api_key():
    provider = DeepLProvider(api_key="")
    with pytest.raises(TranslationConfigError, match="não configurada"):
        await provider.translate("Hello world", "PT-BR")


@pytest.mark.asyncio
async def test_deepl_translate_single_text_success():
    provider = DeepLProvider(api_key="test-key:fx")

    fake_response_data = {
        "translations": [
            {
                "detected_source_language": "EN",
                "text": "Olá mundo",
            }
        ]
    }

    mock_response = httpx.Response(
        status_code=200,
        json=fake_response_data,
        request=httpx.Request("POST", provider.api_url),
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
        result = await provider.translate("Hello world", "pt-br")

        assert result.text == "Olá mundo"
        assert result.detected_source_language == "EN"
        assert result.target_language == "PT-BR"
        assert result.provider == "deepl"
        mock_post.assert_called_once()


@pytest.mark.asyncio
async def test_deepl_skips_when_already_portuguese():
    provider = DeepLProvider(api_key="test-key:fx")

    pt_title = "Novo processador para computadores é anunciado no Brasil"
    with patch("httpx.AsyncClient.post") as mock_post:
        result = await provider.translate_article(
            title=pt_title,
            summary="Uma novidade com tecnologia de ponta para usuários",
            content=None,
            target_language="pt-br",
        )
        assert result.translated_title == pt_title
        assert result.detected_source_language == "PT"
        mock_post.assert_not_called()


@pytest.mark.asyncio
async def test_deepl_translate_article_batch_success():
    provider = DeepLProvider(api_key="test-key:fx")

    fake_response_data = {
        "translations": [
            {
                "detected_source_language": "EN",
                "text": "Nova versão do Linux lançada",
            },
            {
                "detected_source_language": "EN",
                "text": "Esta versão traz melhorias no suporte a hardware.",
            },
            {
                "detected_source_language": "EN",
                "text": "<p>Detalhes completos sobre o lançamento.</p>",
            },
        ]
    }

    mock_response = httpx.Response(
        status_code=200,
        json=fake_response_data,
        request=httpx.Request("POST", provider.api_url),
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        result = await provider.translate_article(
            title="New Linux version released",
            summary="This version brings hardware support improvements.",
            content="<p>Full details about release.</p>",
            target_language="pt-BR",
        )

        assert result.translated_title == "Nova versão do Linux lançada"
        assert result.translated_summary == "Esta versão traz melhorias no suporte a hardware."
        assert result.translated_content == "<p>Detalhes completos sobre o lançamento.</p>"
        assert result.detected_source_language == "EN"
        assert result.provider == "deepl"


@pytest.mark.asyncio
async def test_deepl_auth_error_403():
    provider = DeepLProvider(api_key="bad-key:fx")

    mock_response = httpx.Response(
        status_code=403,
        request=httpx.Request("POST", provider.api_url),
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        with pytest.raises(TranslationAuthError, match="inválida ou sem permissão"):
            await provider.translate("Hello", "PT-BR")


@pytest.mark.asyncio
async def test_deepl_quota_error_456():
    provider = DeepLProvider(api_key="valid-key:fx")

    mock_response = httpx.Response(
        status_code=456,
        request=httpx.Request("POST", provider.api_url),
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        with pytest.raises(TranslationQuotaError, match="Cota mensal"):
            await provider.translate("Hello", "PT-BR")


@pytest.mark.asyncio
async def test_deepl_rate_limit_429():
    provider = DeepLProvider(api_key="valid-key:fx")

    mock_response = httpx.Response(
        status_code=429,
        request=httpx.Request("POST", provider.api_url),
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        with pytest.raises(TranslationQuotaError, match="Muitas requisições"):
            await provider.translate("Hello", "PT-BR")


@pytest.mark.asyncio
async def test_deepl_server_error_500_retries():
    provider = DeepLProvider(api_key="valid-key:fx")

    mock_response = httpx.Response(
        status_code=500,
        request=httpx.Request("POST", provider.api_url),
    )

    with (
        patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post,
        patch("asyncio.sleep", return_value=None),
    ):
        with pytest.raises(TranslationUnavailableError):
            await provider.translate("Hello", "PT-BR")

        # Initial attempt + 2 retries = 3 calls
        assert mock_post.call_count == 3


@pytest.mark.asyncio
async def test_deepl_timeout_retries():
    provider = DeepLProvider(api_key="valid-key:fx")

    with (
        patch(
            "httpx.AsyncClient.post",
            side_effect=httpx.ReadTimeout("Timeout connecting to DeepL"),
        ) as mock_post,
        patch("asyncio.sleep", return_value=None),
    ):
        with pytest.raises(TranslationUnavailableError, match="Não foi possível conectar"):
            await provider.translate("Hello", "PT-BR")

        assert mock_post.call_count == 3


def test_factory_disabled():
    with patch.object(settings, "TRANSLATION_ENABLED", False):
        with pytest.raises(TranslationDisabledError, match="desativado no momento"):
            get_translation_provider()


def test_factory_deepl():
    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch.object(settings, "TRANSLATION_PROVIDER", "deepl"),
    ):
        provider = get_translation_provider()
        assert isinstance(provider, DeepLProvider)
        assert provider.provider_name == "deepl"


def test_factory_mymemory():
    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch.object(settings, "TRANSLATION_PROVIDER", "mymemory"),
    ):
        from app.translation.mymemory import MyMemoryProvider

        provider = get_translation_provider()
        assert isinstance(provider, MyMemoryProvider)
        assert provider.provider_name == "mymemory"


def test_factory_mock():
    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch.object(settings, "TRANSLATION_PROVIDER", "mock"),
    ):
        from app.translation.mock import MockTranslationProvider

        provider = get_translation_provider()
        assert isinstance(provider, MockTranslationProvider)
        assert provider.provider_name == "mock"


def test_factory_auto_without_key():
    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch.object(settings, "TRANSLATION_PROVIDER", "auto"),
        patch.object(settings, "TRANSLATION_API_KEY", ""),
    ):
        from app.translation.mymemory import MyMemoryProvider

        provider = get_translation_provider()
        assert isinstance(provider, MyMemoryProvider)


def test_factory_auto_with_key():
    with (
        patch.object(settings, "TRANSLATION_ENABLED", True),
        patch.object(settings, "TRANSLATION_PROVIDER", "auto"),
        patch.object(settings, "TRANSLATION_API_KEY", "some-key:fx"),
    ):
        provider = get_translation_provider()
        assert isinstance(provider, DeepLProvider)


@pytest.mark.asyncio
async def test_mymemory_translate_single_text_success():
    from app.translation.mymemory import MyMemoryProvider

    provider = MyMemoryProvider()
    fake_data = {
        "responseStatus": 200,
        "responseData": {
            "translatedText": "Olá mundo",
            "match": 0.9,
        },
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=fake_data,
        request=httpx.Request("GET", provider.api_url),
    )

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await provider.translate("Hello world", "pt-BR")
        assert res.text == "Olá mundo"
        assert res.target_language == "pt-BR"
        assert res.provider == "mymemory"


@pytest.mark.asyncio
async def test_mymemory_quota_error():
    from app.translation.mymemory import MyMemoryProvider

    provider = MyMemoryProvider()
    fake_data = {
        "responseStatus": 429,
        "quotaFinished": True,
        "responseData": {},
    }

    mock_resp = httpx.Response(
        status_code=200,
        json=fake_data,
        request=httpx.Request("GET", provider.api_url),
    )

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        with pytest.raises(TranslationQuotaError, match="Cota diária"):
            await provider.translate("Hello world", "pt-BR")


@pytest.mark.asyncio
async def test_mock_provider_translate():
    from app.translation.mock import MockTranslationProvider

    provider = MockTranslationProvider()
    res = await provider.translate("Test title", "pt-BR")
    assert res.text == "[PT] Test title"
    assert res.provider == "mock"

    article_res = await provider.translate_article(
        title="Breaking News",
        summary="Short summary",
        content=None,
        target_language="pt-BR",
    )
    assert article_res.translated_title == "[PT] Breaking News"
    assert article_res.translated_summary == "[PT] Short summary"
