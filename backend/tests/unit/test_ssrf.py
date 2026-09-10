from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.ssrf import (
    SSRFValidationError,
    safe_fetch_feed,
    validate_url_ssrf,
)


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost",
        "http://localhost:8080/rss",
        "http://127.0.0.1",
        "http://127.0.0.1:8000/feed",
        "http://0.0.0.0",
        "http://[::1]",
        "http://[::1]:8080/feed",
        "http://192.168.1.1/feed.xml",
        "http://192.168.0.254/rss",
        "http://10.0.0.1/feed",
        "http://10.255.255.255/feed",
        "http://172.16.0.1/feed",
        "http://169.254.169.254/latest/meta-data/",
        "http://169.254.170.2/v2/credentials",
        "file:///etc/passwd",
        "ftp://example.com/feed.xml",
        "gopher://example.com/",
        "data:text/plain;base64,SGVsbG8=",
        "javascript:alert(1)",
    ],
)
def test_validate_url_ssrf_rejects_forbidden_targets(url: str):
    with pytest.raises(SSRFValidationError):
        validate_url_ssrf(url)


def test_validate_url_ssrf_rejects_dns_resolving_to_private():
    with patch("socket.getaddrinfo") as mock_dns:
        # Mock DNS resolving to 192.168.1.50
        mock_dns.return_value = [
            (2, 1, 6, "", ("192.168.1.50", 80)),
        ]
        with pytest.raises(SSRFValidationError) as exc_info:
            validate_url_ssrf("http://my-internal-nas.com/feed.xml")
        assert "192.168.1.50" in str(exc_info.value)


def test_validate_url_ssrf_allows_public_ip():
    # 8.8.8.8 is a public IP
    valid = validate_url_ssrf("https://8.8.8.8/feed.rss")
    assert valid == "https://8.8.8.8/feed.rss"


@pytest.mark.asyncio
async def test_safe_fetch_feed_rejects_redirect_to_internal_ip():
    # Mock first response returning 302 redirect to http://169.254.169.254
    mock_resp_1 = MagicMock()
    mock_resp_1.status_code = 302
    mock_resp_1.headers = {"Location": "http://169.254.169.254/latest/meta-data"}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp_1)

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        # Mock initial DNS resolution as public IP 93.184.216.34
        with patch("socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 80))]

            # Fetching from public domain that redirects to 169.254.169.254 must fail
            with pytest.raises(SSRFValidationError):
                await safe_fetch_feed("http://legit-looking.com/feed")
