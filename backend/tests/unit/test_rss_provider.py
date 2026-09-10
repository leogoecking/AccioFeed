from pathlib import Path

from app.sources.rss.parser import RSSParser
from app.sources.rss.provider import RSSProvider

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


def test_parse_sample_rss():
    content = (FIXTURES_DIR / "sample_rss.xml").read_text(encoding="utf-8")
    articles = RSSParser.parse_feed(content, default_category="technology")

    assert len(articles) == 1
    art = articles[0]
    assert art.external_id == "tech-guid-1001"
    assert art.title == "Next-Gen Quantum Processors Unveiled"
    assert art.url == "https://techinsights.example.com/articles/quantum-processors-2026"
    assert art.author == "Dr. Ada Lovelace"
    assert "scalable 5000-qubit processor" in (art.summary or "")
    assert art.image_url == "https://techinsights.example.com/images/quantum.jpg"
    assert art.category == "hardware"
    assert art.published_at is not None


def test_parse_sample_atom():
    content = (FIXTURES_DIR / "sample_atom.xml").read_text(encoding="utf-8")
    articles = RSSParser.parse_feed(content, default_category="technology")

    assert len(articles) == 1
    art = articles[0]
    assert art.external_id == "urn:entry:engineering:2026:rust-workflows"
    assert art.title == "Building Distributed Workflows in Rust"
    assert art.url == "https://engineering.example.com/posts/rust-workflows?id=99"
    assert art.author == "Linus Tech"
    assert "deep dive into building async actors" in (art.summary or "")
    assert art.category == "dev"


def test_parse_sample_malicious_xss_stripped():
    content = (FIXTURES_DIR / "sample_malicious.xml").read_text(encoding="utf-8")
    articles = RSSParser.parse_feed(content, default_category="technology")

    assert len(articles) == 1
    art = articles[0]
    assert "<script>" not in art.title
    assert "alert" not in art.title
    assert "Innocent Looking News" in art.title
    assert art.summary is not None
    assert "<script" not in art.summary
    assert "<iframe" not in art.summary
    assert "javascript:" not in art.summary
    assert "onerror" not in art.summary


def test_parse_sample_missing_fields_graceful():
    content = (FIXTURES_DIR / "sample_missing_fields.xml").read_text(encoding="utf-8")
    articles = RSSParser.parse_feed(content, default_category="technology")

    assert len(articles) == 1
    art = articles[0]
    assert art.title == "Article With Missing Optional Fields"
    assert art.url == "https://minimal.example.com/item/42"
    # external_id falls back to canonical URL when no guid is present
    assert art.external_id == "https://minimal.example.com/item/42"
    assert art.author is None
    assert art.summary is None
    assert art.image_url is None
    # Invalid date defaults safely to current datetime
    assert art.published_at is not None

    provider = RSSProvider(
        name="Minimal",
        slug="minimal",
        feed_url="https://minimal.example.com/feed",
        base_url="https://minimal.example.com",
    )
    assert provider.validate(art) is True
