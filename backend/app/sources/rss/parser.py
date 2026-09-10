import calendar
import hashlib
from datetime import UTC, datetime
from typing import Any

import feedparser

from app.sources.base import NormalizedArticle
from app.sources.sanitizer import extract_image_from_html, sanitize_text
from app.sources.url_utils import canonicalize_url


class RSSParser:
    """
    Robust RSS & Atom feed parser.
    Converts feedparser entries into NormalizedArticle canonical models.
    """

    @classmethod
    def parse_feed(
        cls,
        feed_content: str | bytes,
        default_category: str = "technology",
    ) -> list[NormalizedArticle]:
        parsed = feedparser.parse(feed_content)
        articles: list[NormalizedArticle] = []

        for entry in parsed.entries:
            norm = cls.normalize_entry(entry, default_category=default_category)
            if norm:
                articles.append(norm)

        return articles

    @classmethod
    def normalize_entry(
        cls,
        entry: Any,
        default_category: str = "technology",
    ) -> NormalizedArticle | None:
        title = sanitize_text(entry.get("title"))
        raw_link = entry.get("link") or ""
        canonical_link = canonicalize_url(raw_link)

        if not title or not canonical_link:
            return None

        # 1. External ID resolution
        external_id = cls._resolve_external_id(entry, canonical_link)

        # 2. Published date resolution
        published_at = cls._resolve_published_date(entry)

        # 3. Author resolution
        author = cls._resolve_author(entry)

        # 4. Summary and content resolution
        summary_raw = entry.get("summary") or entry.get("description") or ""
        content_raw = ""
        if "content" in entry and isinstance(entry.content, list) and len(entry.content) > 0:
            content_raw = entry.content[0].get("value", "")

        summary = sanitize_text(summary_raw, max_length=400)
        # If no summary, try generating from content
        if not summary and content_raw:
            summary = sanitize_text(content_raw, max_length=400)

        # 5. Image extraction (media_content, media_thumbnail, enclosures, HTML img)
        image_url = cls._extract_image(entry, summary_raw, content_raw)

        # 6. Category resolution
        category = cls._resolve_category(entry, default_category)

        return NormalizedArticle(
            external_id=external_id,
            title=title,
            url=canonical_link,
            published_at=published_at,
            author=author,
            summary=summary,
            content=None,  # We don't store full scraped text for copyright/brevity
            image_url=image_url,
            category=category,
            language="en",
            score=None,
            comments_count=None,
        )

    @classmethod
    def _resolve_external_id(cls, entry: Any, canonical_link: str) -> str:
        """
        Priority:
        1. guid / id
        2. atom id
        3. canonical URL
        4. deterministic SHA-256 hash of canonical URL
        """
        raw_id = entry.get("id") or entry.get("guid")
        if raw_id and str(raw_id).strip():
            return str(raw_id).strip()

        if canonical_link:
            return canonical_link

        # Deterministic fallback
        return hashlib.sha256(canonical_link.encode("utf-8")).hexdigest()

    @classmethod
    def _resolve_published_date(cls, entry: Any) -> datetime:
        date_struct = entry.get("published_parsed") or entry.get("updated_parsed")
        if date_struct:
            try:
                timestamp = calendar.timegm(date_struct)
                return datetime.fromtimestamp(timestamp, tz=UTC)
            except Exception:
                pass
        return datetime.now(UTC)

    @classmethod
    def _resolve_author(cls, entry: Any) -> str | None:
        author = entry.get("author") or entry.get("dc_creator")
        if not author and "author_detail" in entry and isinstance(entry.author_detail, dict):
            author = entry.author_detail.get("name")
        if author:
            return sanitize_text(str(author), max_length=100)
        return None

    @classmethod
    def _extract_image(cls, entry: Any, summary_raw: str, content_raw: str) -> str | None:
        # Check media:content
        media_content = entry.get("media_content")
        if isinstance(media_content, list):
            for m in media_content:
                if isinstance(m, dict):
                    url = m.get("url")
                    m_type = m.get("type", "")
                    m_medium = m.get("medium", "")
                    if url and (m_medium == "image" or "image" in m_type or not m_type):
                        if url.startswith("http://") or url.startswith("https://"):
                            return url.strip()

        # Check media:thumbnail
        media_thumb = entry.get("media_thumbnail")
        if isinstance(media_thumb, list):
            for t in media_thumb:
                if isinstance(t, dict):
                    url = t.get("url")
                    if url and (url.startswith("http://") or url.startswith("https://")):
                        return url.strip()

        # Check enclosures
        enclosures = entry.get("enclosures")
        if isinstance(enclosures, list):
            for enc in enclosures:
                if isinstance(enc, dict):
                    url = enc.get("href") or enc.get("url")
                    enc_type = enc.get("type", "")
                    if url and ("image" in enc_type or enc_type.startswith("image/")):
                        return url.strip()

        # Check HTML img in content or summary
        from_content = extract_image_from_html(content_raw)
        if from_content:
            return from_content

        from_summary = extract_image_from_html(summary_raw)
        if from_summary:
            return from_summary

        return None

    @classmethod
    def _resolve_category(cls, entry: Any, default_category: str) -> str:
        # Check entry tags if available
        tags = entry.get("tags")
        if isinstance(tags, list):
            for tag in tags:
                if isinstance(tag, dict) and tag.get("term"):
                    term = tag["term"].lower()
                    if term in (
                        "ai",
                        "artificial intelligence",
                        "machine learning",
                        "deep learning",
                    ):
                        return "ai"
                    if term in ("hardware", "chips", "gpu", "cpu", "semiconductors"):
                        return "hardware"
                    if term in ("dev", "development", "programming", "software"):
                        return "dev"
                    if term in ("linux", "kernel", "open source", "opensource", "foss"):
                        return "linux"
                    if term in ("cybersecurity", "security", "infosec"):
                        return "cybersecurity"
                    if term in ("science", "physics", "space"):
                        return "science"
                    if term in ("startups", "venture capital", "business"):
                        return "startups"
                    if term in ("gaming", "games"):
                        return "games"
        return default_category
