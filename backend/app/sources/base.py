from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class NormalizedArticle:
    external_id: str
    title: str
    url: str
    published_at: datetime
    author: str | None = None
    summary: str | None = None
    content: str | None = None
    image_url: str | None = None
    category: str = "general"
    language: str = "en"
    score: int | None = None
    comments_count: int | None = None


class BaseSourceProvider(ABC):
    name: str
    slug: str
    source_type: str  # "api", "rss", etc.
    base_url: str
    feed_url: str | None = None

    @abstractmethod
    async def fetch(self, limit: int = 30) -> list[Any]:
        """Fetch raw items from external source."""
        pass

    @abstractmethod
    def normalize(self, raw_item: Any) -> NormalizedArticle | None:
        """Normalize a raw item into a standardized NormalizedArticle."""
        pass

    def validate(self, article: NormalizedArticle) -> bool:
        """Validate that the normalized article contains required valid data."""
        if not article.external_id or not article.title or not article.url:
            return False
        if not article.title.strip() or not article.url.strip():
            return False
        if not (article.url.startswith("http://") or article.url.startswith("https://")):
            return False
        if not article.published_at:
            return False
        return True
