from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.extraction.extractor import ContentExtractor
from app.models.article_content import ContentLevel, determine_content_level
from app.sources.sanitizer import sanitize_editorial_content


@pytest.mark.asyncio
async def test_content_level_determination():
    # 1. Full content (extensive text >= 800 chars or >= 150 words)
    long_content = "This is an in-depth technological article analyzing system design. " * 30
    assert determine_content_level(content=long_content) == ContentLevel.FULL

    # 2. Partial content (short summary >= 60 chars)
    short_summary = "A concise overview of the new release notes highlighting main improvements."
    assert determine_content_level(summary=short_summary) == ContentLevel.PARTIAL

    # 3. Metadata only (< 60 chars summary, empty content)
    tiny_summary = "Brief update"
    assert determine_content_level(summary=tiny_summary) == ContentLevel.METADATA_ONLY
    assert determine_content_level(summary=None, content=None) == ContentLevel.METADATA_ONLY


def test_sanitize_editorial_content_removes_scripts_and_malicious_links():
    html_input = """
    <div>
        <script>alert('pwned')</script>
        <h1>Article Title</h1>
        <p>Valid paragraph content discussing open-source software.</p>
        <a href="javascript:stealCookies()">Malicious link</a>
        <a href="https://example.com/safe">Safe link</a>
        <iframe src="https://attacker.com"></iframe>
    </div>
    """
    sanitized = sanitize_editorial_content(html_input)
    assert sanitized is not None
    assert "alert('pwned')" not in sanitized
    assert "<script>" not in sanitized
    assert "<iframe>" not in sanitized
    assert "javascript:" not in sanitized
    assert "Valid paragraph content discussing open-source software." in sanitized


@pytest.mark.asyncio
async def test_extractor_simple_article_success():
    url = "https://example.com/article"
    html = (
        "<!DOCTYPE html><html><head><title>Linux Kernel 6.12 Released</title></head><body>"
        "<article><h1>Linux Kernel 6.12 Released</h1>"
        "<p>"
        + (
            "The Linux kernel 6.12 has officially landed with full real-time capabilities and enhanced memory management. "
            * 10
        )
        + "</p>"
        "<p>"
        + (
            "Engineers can now enable PREEMPT_RT out of the box on standard distributions with deterministic latency. "
            * 10
        )
        + "</p>"
        "</article></body></html>"
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = html.encode("utf-8")
    mock_resp.headers = {"Content-Type": "text/html; charset=utf-8"}
    mock_resp.encoding = "utf-8"

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]

        extractor = ContentExtractor(http_client=mock_client)
        result = await extractor.extract(url)

        assert result.success is True
        assert result.content is not None
        assert "Linux Kernel 6.12" in result.content
        assert result.error_reason is None
        assert result.method == "trafilatura"


@pytest.mark.asyncio
async def test_extractor_filters_ads_and_menus():
    url = "https://example.com/tech-news"
    html = (
        "<!DOCTYPE html><html><head><title>Tech News</title></head><body>"
        "<nav><a href='/home'>Home</a><a href='/login'>Sign In</a></nav>"
        "<div class='ad-banner'>Buy crypto today! Huge bonus!</div>"
        "<article><h1>Tech News Article</h1>"
        "<p>"
        + (
            "Major architectural changes have been announced for the web framework ecosystem today. "
            * 10
        )
        + "</p>"
        "<p>"
        + (
            "Developers report significant speedups in compilation times and developer ergonomics across teams. "
            * 10
        )
        + "</p>"
        "</article>"
        "<footer><p>Copyright 2026. All rights reserved.</p></footer>"
        "</body></html>"
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = html.encode("utf-8")
    mock_resp.headers = {"Content-Type": "text/html"}
    mock_resp.encoding = "utf-8"

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]

        extractor = ContentExtractor(http_client=mock_client)
        result = await extractor.extract(url)

        assert result.success is True
        assert result.content is not None
        assert "Buy crypto today" not in result.content
        assert "Sign In" not in result.content


@pytest.mark.asyncio
async def test_extractor_blocks_ssrf_urls():
    extractor = ContentExtractor()

    for unsafe in [
        "http://localhost:8000/secret",
        "http://127.0.0.1/admin",
        "http://10.0.0.1/internal",
        "http://192.168.1.1/router",
        "http://169.254.169.254/latest/meta-data",
        "ftp://example.com/file",
        "file:///etc/passwd",
    ]:
        res = await extractor.extract(unsafe)
        assert res.success is False
        assert res.error_reason == "unsafe_url"


@pytest.mark.asyncio
async def test_extractor_blocks_redirect_to_private_ip():
    url = "https://example.com/redirect-to-private"

    mock_resp = MagicMock()
    mock_resp.status_code = 302
    mock_resp.headers = {"Location": "http://127.0.0.1:8080/internal"}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]

        extractor = ContentExtractor(http_client=mock_client)
        result = await extractor.extract(url)
        assert result.success is False
        assert result.error_reason == "unsafe_url"


@pytest.mark.asyncio
async def test_extractor_rejects_unsupported_content_type():
    url = "https://example.com/archive.zip"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b"PK\x03\x04fakezipcontent"
    mock_resp.headers = {"Content-Type": "application/zip"}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]

        extractor = ContentExtractor(http_client=mock_client)
        result = await extractor.extract(url)
        assert result.success is False
        assert result.error_reason == "unsupported_content_type"


@pytest.mark.asyncio
async def test_extractor_rejects_oversized_response():
    url = "https://example.com/huge-page"
    huge_data = b"x" * (4 * 1024 * 1024)  # 4MB

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = huge_data
    mock_resp.headers = {"Content-Type": "text/html", "Content-Length": str(len(huge_data))}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]

        extractor = ContentExtractor(max_bytes=1024 * 1024, http_client=mock_client)  # 1MB limit
        result = await extractor.extract(url)
        assert result.success is False
        assert result.error_reason == "response_too_large"


@pytest.mark.asyncio
async def test_extractor_handles_http_403_and_paywalls():
    url = "https://example.com/paywalled"

    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.headers = {"Content-Type": "text/html"}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("socket.getaddrinfo") as mock_dns:
        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]

        extractor = ContentExtractor(http_client=mock_client)
        result = await extractor.extract(url)
        assert result.success is False
        assert result.error_reason == "http_403"
