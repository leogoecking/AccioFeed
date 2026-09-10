from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.source import Source
from app.repositories.source_repository import SourceRepository

DEFAULT_SOURCES: list[dict[str, Any]] = [
    {
        "name": "Hacker News",
        "slug": "hacker-news",
        "type": "hacker_news",
        "base_url": "https://news.ycombinator.com",
        "feed_url": "https://hacker-news.firebaseio.com/v0",
        "default_category": "technology",
        "poll_interval_minutes": 5,
        "is_active": True,
    },
    {
        "name": "Ars Technica",
        "slug": "ars-technica",
        "type": "rss",
        "base_url": "https://arstechnica.com",
        "feed_url": "https://feeds.arstechnica.com/arstechnica/index",
        "default_category": "technology",
        "poll_interval_minutes": 15,
        "is_active": True,
    },
    {
        "name": "The Verge",
        "slug": "the-verge",
        "type": "rss",
        "base_url": "https://www.theverge.com",
        "feed_url": "https://www.theverge.com/rss/index.xml",
        "default_category": "technology",
        "poll_interval_minutes": 15,
        "is_active": True,
    },
    {
        "name": "Tom's Hardware",
        "slug": "toms-hardware",
        "type": "rss",
        "base_url": "https://www.tomshardware.com",
        "feed_url": "https://www.tomshardware.com/feeds/all",
        "default_category": "hardware",
        "poll_interval_minutes": 15,
        "is_active": True,
    },
    {
        "name": "MIT Technology Review",
        "slug": "mit-tech-review",
        "type": "rss",
        "base_url": "https://www.technologyreview.com",
        "feed_url": "https://www.technologyreview.com/feed/",
        "default_category": "ai",
        "poll_interval_minutes": 30,
        "is_active": True,
    },
    {
        "name": "IEEE Spectrum",
        "slug": "ieee-spectrum",
        "type": "rss",
        "base_url": "https://spectrum.ieee.org",
        "feed_url": "https://spectrum.ieee.org/feeds/feed.rss",
        "default_category": "science",
        "poll_interval_minutes": 30,
        "is_active": True,
    },
    {
        "name": "GitHub Blog",
        "slug": "github-blog",
        "type": "rss",
        "base_url": "https://github.blog",
        "feed_url": "https://github.blog/feed/",
        "default_category": "dev",
        "poll_interval_minutes": 30,
        "is_active": True,
    },
    {
        "name": "Phoronix",
        "slug": "phoronix",
        "type": "rss",
        "base_url": "https://www.phoronix.com",
        "feed_url": "https://www.phoronix.com/phoronix-rss.php",
        "default_category": "linux",
        "poll_interval_minutes": 15,
        "is_active": True,
    },
]


async def seed_sources(db: AsyncSession) -> list[Source]:
    """
    Idempotently seeds or updates the default sources in the database.
    """
    repo = SourceRepository(db)
    seeded: list[Source] = []
    for s_data in DEFAULT_SOURCES:
        source = await repo.get_or_create(
            slug=s_data["slug"],
            name=s_data["name"],
            type=s_data["type"],
            base_url=s_data["base_url"],
            feed_url=s_data["feed_url"],
            default_category=s_data["default_category"],
            poll_interval_minutes=s_data["poll_interval_minutes"],
            is_active=s_data["is_active"],
        )
        seeded.append(source)
    return seeded
