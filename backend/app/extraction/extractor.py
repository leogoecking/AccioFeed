import logging
import urllib.parse
from dataclasses import dataclass
from datetime import datetime

import httpx
import trafilatura

from app.core.ssrf import SSRFValidationError, validate_url_ssrf
from app.sources.sanitizer import sanitize_editorial_content

logger = logging.getLogger(__name__)

DEFAULT_MAX_BYTES = 3 * 1024 * 1024  # 3 Megabytes
DEFAULT_TIMEOUT = 10.0  # 10 seconds
DEFAULT_MAX_REDIRECTS = 3
DEFAULT_USER_AGENT = "AccioFeed/1.0 (+https://github.com/leogoecking/AccioFeed; Editorial Reader)"

SUPPORTED_CONTENT_TYPES = ("text/html", "application/xhtml+xml")

PAYWALL_SIGNATURES = (
    "paywall",
    "subscribe to read",
    "subscriber-only",
    "exclusive for subscribers",
    "sign in to continue reading",
    "create a free account to read",
    "assine para ler",
    "conteúdo exclusivo para assinantes",
)


@dataclass
class ExtractionResult:
    """Standardized representation of full-text editorial extraction results."""

    title: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    content: str | None = None
    language: str | None = None
    success: bool = False
    method: str = "trafilatura"
    error_reason: str | None = None


class ContentExtractor:
    """Safe editorial full-text extractor for public web articles."""

    def __init__(
        self,
        max_bytes: int = DEFAULT_MAX_BYTES,
        timeout: float = DEFAULT_TIMEOUT,
        max_redirects: int = DEFAULT_MAX_REDIRECTS,
        user_agent: str = DEFAULT_USER_AGENT,
        http_client: httpx.AsyncClient | None = None,
    ):
        self.max_bytes = max_bytes
        self.timeout = timeout
        self.max_redirects = max_redirects
        self.user_agent = user_agent
        self._external_client = http_client

    async def _fetch_html(self, url: str) -> tuple[str | None, str | None]:
        """Safely fetches remote HTML ensuring SSRF defense, redirect re-validation,

        content-type checking, and payload size capping.
        Returns (html_string, error_reason).
        """
        current_url = url
        redirects_count = 0

        # Validate initial URL
        try:
            current_url = validate_url_ssrf(current_url)
        except SSRFValidationError as exc:
            logger.warning("Extraction URL rejected by SSRF protection: %s (%s)", url, exc)
            return None, "unsafe_url"

        client = self._external_client
        should_close = False
        if client is None:
            client = httpx.AsyncClient(
                follow_redirects=False,
                timeout=httpx.Timeout(self.timeout, connect=5.0),
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "text/html, application/xhtml+xml;q=0.9, */*;q=0.1",
                    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
                },
            )
            should_close = True

        try:
            while True:
                try:
                    response = await client.get(current_url)
                except httpx.TimeoutException:
                    logger.debug("Extraction timeout fetching %s", current_url)
                    return None, "timeout"
                except httpx.RequestError as exc:
                    logger.debug("Extraction network error fetching %s: %s", current_url, exc)
                    return None, "extraction_failed"

                # Handle HTTP redirects manually with SSRF re-validation at each hop
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("Location")
                    if not location:
                        return None, "extraction_failed"

                    redirects_count += 1
                    if redirects_count > self.max_redirects:
                        return None, "extraction_failed"

                    next_url = urllib.parse.urljoin(current_url, location)
                    try:
                        current_url = validate_url_ssrf(next_url)
                    except SSRFValidationError:
                        return None, "unsafe_url"
                    continue

                # Check HTTP response status
                if response.status_code in (401, 403):
                    return None, "http_403"
                if response.status_code == 404:
                    return None, "not_found"
                if response.status_code == 429:
                    return None, "rate_limited"
                if response.status_code >= 400:
                    return None, "extraction_failed"

                # Validate Content-Type
                content_type = (
                    response.headers.get("Content-Type", "").lower().split(";")[0].strip()
                )
                if content_type and not any(ct in content_type for ct in SUPPORTED_CONTENT_TYPES):
                    logger.debug(
                        "Unsupported content type for extraction '%s' on %s",
                        content_type,
                        current_url,
                    )
                    return None, "unsupported_content_type"

                # Validate response size limit
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > self.max_bytes:
                    return None, "response_too_large"

                body = response.content
                if len(body) > self.max_bytes:
                    return None, "response_too_large"

                # Decode HTML with fallback
                encoding = response.encoding or "utf-8"
                try:
                    html_text = body.decode(encoding, errors="replace")
                except Exception:
                    html_text = body.decode("utf-8", errors="replace")

                return html_text, None

        finally:
            if should_close:
                await client.aclose()

    async def extract(self, url: str) -> ExtractionResult:
        """Extracts editorial content from a public web page URL.

        Never attempts to bypass paywalls, captchas, or auth.
        """
        html_text, error_reason = await self._fetch_html(url)
        if error_reason or not html_text:
            return ExtractionResult(
                success=False,
                error_reason=error_reason or "extraction_failed",
            )

        # Check for paywall keywords in page text
        lower_html = html_text.lower()
        if any(sig in lower_html for sig in PAYWALL_SIGNATURES):
            # If explicit paywall indicators found and text is short, classify cleanly
            pass

        try:
            # Trafilatura extract
            extracted_markdown = trafilatura.extract(
                html_text,
                output_format="markdown",
                include_links=True,
                include_images=False,
                include_tables=True,
                no_fallback=False,
                favor_recall=True,
            )
        except Exception as exc:
            logger.debug("Trafilatura extraction exception for %s: %s", url, exc)
            return ExtractionResult(success=False, error_reason="extraction_failed")

        if not extracted_markdown or len(extracted_markdown.strip()) < 150:
            if any(sig in lower_html for sig in PAYWALL_SIGNATURES):
                return ExtractionResult(success=False, error_reason="paywall_or_restricted")
            return ExtractionResult(success=False, error_reason="extraction_failed")

        # Sanitize extracted markdown against any rogue scripts or dangerous links
        sanitized_content = sanitize_editorial_content(extracted_markdown)
        if not sanitized_content or len(sanitized_content.strip()) < 150:
            return ExtractionResult(success=False, error_reason="extraction_failed")

        # Try to extract metadata if available
        meta_doc = None
        try:
            meta_doc = trafilatura.bare_extraction(html_text)
        except Exception:
            pass

        title = meta_doc.title if meta_doc else None
        author = meta_doc.author if meta_doc else None
        language = meta_doc.language if meta_doc else None

        return ExtractionResult(
            title=title,
            author=author,
            content=sanitized_content,
            language=language,
            success=True,
            method="trafilatura",
            error_reason=None,
        )
