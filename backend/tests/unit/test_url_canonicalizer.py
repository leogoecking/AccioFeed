from app.sources.url_utils import canonicalize_url


def test_canonicalize_url_strips_utm_parameters():
    raw_url = "https://example.com/articles/ai-revolution?utm_source=rss&utm_medium=feed&utm_campaign=daily"
    expected = "https://example.com/articles/ai-revolution"
    assert canonicalize_url(raw_url) == expected


def test_canonicalize_url_preserves_functional_parameters():
    raw_url = "https://example.com/news.php?id=9876&utm_source=newsletter&category=tech"
    # Expected: query params sorted alphabetically, utm removed
    expected = "https://example.com/news.php?category=tech&id=9876"
    assert canonicalize_url(raw_url) == expected


def test_canonicalize_url_normalizes_host_scheme_and_fragment():
    raw_url = "HTTP://WWW.EXAMPLE.COM:80/tech/post/?utm_source=feed#section2"
    expected = "http://www.example.com/tech/post"
    assert canonicalize_url(raw_url) == expected


def test_canonicalize_url_root_path():
    assert canonicalize_url("https://example.com/") == "https://example.com/"
    assert canonicalize_url("https://example.com") == "https://example.com/"
    assert canonicalize_url("") == ""
