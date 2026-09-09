import re
from datetime import UTC, datetime
from typing import Any

from app.sources.base import BaseSourceProvider, NormalizedArticle
from app.sources.hacker_news.client import HackerNewsClient


def guess_category(title: str) -> str:
    title_lower = title.lower()

    patterns = [
        (
            r"\b(ai|llm|gpt|openai|claude|gemini|deepseek|anthropic|machine learning|neural|deep learning)\b",
            "ai",
        ),
        (r"\b(linux|kernel|ubuntu|debian|arch|distro|systemd)\b", "linux"),
        (r"\b(open[- ]source|foss|gnu|mit license|gpl)\b", "opensource"),
        (
            r"\b(nvidia|amd|intel|gpu|cpu|chip|chips|semiconductor|arm|tsmc|hardware|transistor|ssd)\b",
            "hardware",
        ),
        (
            r"\b(vulnerability|cve|hacked|malware|exploit|ransomware|breach|zero[- ]day|security|phishing)\b",
            "cybersecurity",
        ),
        (
            r"\b(python|rust|golang|javascript|typescript|react|compiler|github|git|api|framework|sql|postgres|database|frontend|backend|fastapi|microservices?)\b",
            "dev",
        ),
        (
            r"\b(quantum|physics|telescope|space|biology|dna|nasa|fusion|astronomy|scientific)\b",
            "science",
        ),
        (
            r"\b(startup|startups|venture|vc|funding|seed round|acquisition|ipo|valuation)\b",
            "startups",
        ),
        (
            r"\b(game|games|gaming|steam|nintendo|playstation|xbox|unreal engine|unity)\b",
            "games",
        ),
    ]

    for pattern, category in patterns:
        if re.search(pattern, title_lower):
            return category
    return "general"


class HackerNewsProvider(BaseSourceProvider):
    name = "Hacker News"
    slug = "hacker-news"
    source_type = "api"
    base_url = "https://news.ycombinator.com"
    feed_url = None

    def __init__(self, client: HackerNewsClient | None = None):
        self.client = client or HackerNewsClient()

    async def fetch(self, limit: int = 30) -> list[dict[str, Any]]:
        return await self.client.fetch_stories(story_types=["top", "best"], limit=limit)

    def normalize(self, raw_item: dict[str, Any]) -> NormalizedArticle | None:
        raw_id = raw_item.get("id")
        title = raw_item.get("title")
        if not raw_id or not title:
            return None

        url = raw_item.get("url")
        if not url:
            url = f"https://news.ycombinator.com/item?id={raw_id}"

        time_val = raw_item.get("time")
        if time_val:
            try:
                published_at = datetime.fromtimestamp(int(time_val), tz=UTC)
            except Exception:
                published_at = datetime.now(UTC)
        else:
            published_at = datetime.now(UTC)

        category = guess_category(title)

        return NormalizedArticle(
            external_id=str(raw_id),
            title=title.strip(),
            url=url.strip(),
            published_at=published_at,
            author=raw_item.get("by"),
            summary=raw_item.get("text"),
            content=None,
            image_url=None,
            category=category,
            language="en",
            score=raw_item.get("score"),
            comments_count=raw_item.get("descendants"),
        )
