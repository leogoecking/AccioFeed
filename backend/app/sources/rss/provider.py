from typing import Any

import httpx

from app.core.http import create_http_client
from app.sources.base import BaseSourceProvider, NormalizedArticle
from app.sources.rss.parser import RSSParser


class RSSProvider(BaseSourceProvider):
    """
    Generic RSS/Atom provider.
    Can be instantiated dynamically for any registered RSS/Atom source.
    """

    def __init__(
        self,
        name: str,
        slug: str,
        feed_url: str,
        base_url: str,
        default_category: str = "technology",
        source_type: str = "rss",
        http_client: httpx.AsyncClient | None = None,
    ):
        self.name = name
        self.slug = slug
        self.feed_url = feed_url
        self.base_url = base_url
        self.default_category = default_category
        self.source_type = source_type
        self._custom_client = http_client

    async def fetch(self, limit: int = 30) -> list[NormalizedArticle]:
        if not self.feed_url:
            return []

        client = self._custom_client or create_http_client()
        should_close = self._custom_client is None

        try:
            response = await client.get(self.feed_url)
            response.raise_for_status()
            content = response.content

            articles = RSSParser.parse_feed(
                content,
                default_category=self.default_category,
            )
            return articles[:limit]
        finally:
            if should_close:
                await client.aclose()

    def normalize(self, raw_item: Any) -> NormalizedArticle | None:
        if isinstance(raw_item, NormalizedArticle):
            return raw_item
        return RSSParser.normalize_entry(raw_item, default_category=self.default_category)
