from typing import Any

import feedparser

from app.core.ssrf import safe_fetch_feed
from app.sources.rss.parser import RSSParser
from app.sources.sanitizer import sanitize_text


class FeedValidationError(Exception):
    """Raised when feed content cannot be parsed or is invalid RSS/Atom."""

    pass


class FeedValidator:
    @classmethod
    async def validate_and_preview(cls, feed_url: str) -> dict[str, Any]:
        """
        Validates feed URL security (SSRF), fetches content with size/timeout limits,
        verifies RSS/Atom structure, and returns a detailed preview.
        """
        content = await safe_fetch_feed(feed_url)

        parsed = feedparser.parse(content)

        # If feedparser could not find entries or feed info and has bozo error
        if not parsed.entries and (parsed.bozo and not parsed.feed.get("title")):
            bozo_msg = str(getattr(parsed, "bozo_exception", "Estrutura XML de feed inválida"))
            raise FeedValidationError(f"Não foi possível processar o feed XML: {bozo_msg}")

        # Detect format
        version = parsed.get("version", "").lower()
        if "atom" in version:
            feed_format = "atom"
        elif "rss" in version:
            feed_format = "rss"
        else:
            feed_format = "rss" if len(parsed.entries) > 0 else "unknown"

        feed_info = parsed.get("feed", {})
        title = sanitize_text(feed_info.get("title") or "Feed Sem Título")
        description = sanitize_text(feed_info.get("subtitle") or feed_info.get("description"))
        site_url = feed_info.get("link")

        articles_count = len(parsed.entries)
        latest_title = None
        latest_published_at = None

        sample_articles = []
        for entry in parsed.entries[:5]:
            norm = RSSParser.normalize_entry(entry)
            if norm:
                sample_articles.append(
                    {
                        "title": norm.title,
                        "url": norm.url,
                        "published_at": norm.published_at.isoformat(),
                        "author": norm.author,
                    }
                )

        if sample_articles:
            latest_title = sample_articles[0]["title"]
            latest_published_at = sample_articles[0]["published_at"]

        return {
            "is_valid": True,
            "format": feed_format,
            "title": title,
            "description": description,
            "site_url": site_url,
            "articles_count": articles_count,
            "latest_article_title": latest_title,
            "latest_article_published_at": latest_published_at,
            "sample_articles": sample_articles,
        }
