import httpx

from app.models.source import Source
from app.sources.base import BaseSourceProvider
from app.sources.hacker_news.provider import HackerNewsProvider
from app.sources.rss.provider import RSSProvider


def resolve_provider_for_source(
    source: Source,
    http_client: httpx.AsyncClient | None = None,
) -> BaseSourceProvider:
    """
    Factory that instantiates the appropriate SourceProvider for a given Source entity.
    """
    source_type = source.type.lower()
    if source_type in ("hacker_news", "hn"):
        return HackerNewsProvider()

    # Generic RSS / Atom feed provider
    return RSSProvider(
        name=source.name,
        slug=source.slug,
        feed_url=source.feed_url or "",
        base_url=source.base_url,
        default_category=source.default_category,
        source_type=source.type,
        http_client=http_client,
    )
