from typing import ClassVar

from app.sources.base import BaseSourceProvider
from app.sources.hacker_news.provider import HackerNewsProvider


class ProviderRegistry:
    _providers: ClassVar[dict[str, BaseSourceProvider]] = {}

    @classmethod
    def register(cls, provider: BaseSourceProvider) -> None:
        cls._providers[provider.slug] = provider

    @classmethod
    def get(cls, slug: str) -> BaseSourceProvider | None:
        return cls._providers.get(slug)

    @classmethod
    def list_all(cls) -> list[BaseSourceProvider]:
        return list(cls._providers.values())


# Register default providers
ProviderRegistry.register(HackerNewsProvider())
