from datetime import UTC, datetime

from app.sources.base import NormalizedArticle
from app.sources.hacker_news.provider import HackerNewsProvider, guess_category


def test_guess_category():
    assert guess_category("OpenAI announces GPT-5 reasoning model") == "ai"
    assert guess_category("Linux Kernel 6.12 is officially released") == "linux"
    assert guess_category("Announcing Rust 1.85 with async closures") == "dev"
    assert guess_category("NVIDIA unveils next-gen Blackwell GPU architecture") == "hardware"
    assert guess_category("Critical CVE vulnerability found in popular library") == "cybersecurity"
    assert guess_category("James Webb Space Telescope discovers ancient galaxy") == "science"
    assert guess_category("Random thoughts on modern culture") == "general"


def test_normalize_story_with_external_url():
    provider = HackerNewsProvider()
    raw = {
        "id": 12345,
        "title": "FastAPI is awesome for modern microservices",
        "url": "https://example.com/fastapi-news",
        "by": "author_dev",
        "time": 1700000000,
        "score": 150,
        "descendants": 42,
    }

    normalized = provider.normalize(raw)
    assert normalized is not None
    assert normalized.external_id == "12345"
    assert normalized.title == "FastAPI is awesome for modern microservices"
    assert normalized.url == "https://example.com/fastapi-news"
    assert normalized.author == "author_dev"
    assert normalized.score == 150
    assert normalized.comments_count == 42
    assert normalized.category == "dev"
    assert normalized.published_at == datetime.fromtimestamp(1700000000, tz=UTC)
    assert provider.validate(normalized) is True


def test_normalize_story_without_external_url_ask_hn():
    provider = HackerNewsProvider()
    raw = {
        "id": 99999,
        "title": "Ask HN: What is your favorite Linux distribution in 2026?",
        "by": "user_penguin",
        "time": 1700000100,
        "text": "Curious about what everyone is using on their laptops.",
        "score": 85,
        "descendants": 120,
    }

    normalized = provider.normalize(raw)
    assert normalized is not None
    assert normalized.external_id == "99999"
    assert normalized.url == "https://news.ycombinator.com/item?id=99999"
    assert normalized.category == "linux"
    assert normalized.summary == "Curious about what everyone is using on their laptops."
    assert provider.validate(normalized) is True


def test_validate_invalid_stories():
    provider = HackerNewsProvider()

    # Missing title
    norm_no_title = NormalizedArticle(
        external_id="1",
        title="   ",
        url="https://example.com",
        published_at=datetime.now(UTC),
    )
    assert provider.validate(norm_no_title) is False

    # Invalid URL scheme
    norm_bad_url = NormalizedArticle(
        external_id="1",
        title="Valid Title",
        url="ftp://example.com",
        published_at=datetime.now(UTC),
    )
    assert provider.validate(norm_bad_url) is False
