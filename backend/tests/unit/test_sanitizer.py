from app.sources.sanitizer import (
    extract_image_from_html,
    sanitize_editorial_content,
    sanitize_text,
)


def test_sanitize_text_strips_scripts_and_iframes():
    raw = """
    <p>Good introductory text.</p>
    <script>alert("XSS");</script>
    <iframe src="https://evil.com"></iframe>
    <a href="#" onclick="doBad()">Safe Link</a>
    """
    clean = sanitize_text(raw)
    assert clean is not None
    assert "alert" not in clean
    assert "iframe" not in clean
    assert "doBad" not in clean
    assert "Good introductory text." in clean
    assert "Safe Link" in clean


def test_sanitize_text_truncates_at_word_boundary():
    raw = "The quick brown fox jumps over the lazy dog and runs away into the forest."
    truncated = sanitize_text(raw, max_length=30)
    assert truncated is not None
    assert len(truncated) <= 35
    assert truncated.endswith("...")
    assert not truncated.endswith(" ...")


def test_sanitize_editorial_content_preserves_paragraphs():
    content = "# Title\n\nFirst paragraph with insights.\n\nSecond paragraph with details."
    cleaned = sanitize_editorial_content(content)
    assert cleaned == "# Title\n\nFirst paragraph with insights.\n\nSecond paragraph with details."


def test_sanitize_editorial_content_neutralizes_xss_and_dangerous_links():
    dirty = """# Subtitle

First paragraph.

<script>alert('pwned')</script>

Check [malicious link](javascript:alert(1)) or [normal link](https://example.com).
"""
    cleaned = sanitize_editorial_content(dirty)
    assert cleaned is not None
    assert "alert('pwned')" not in cleaned
    assert "[malicious link](#)" in cleaned
    assert "[normal link](https://example.com)" in cleaned
    assert "First paragraph." in cleaned


def test_extract_image_from_html():
    html = """
    <div>
      <p>Some text</p>
      <img width="1" height="1" src="https://tracker.example.com/pixel.gif" />
      <img src="https://example.com/cover-photo.jpg" alt="Cover" />
    </div>
    """
    img_url = extract_image_from_html(html)
    assert img_url == "https://example.com/cover-photo.jpg"


def test_extract_image_from_html_empty():
    assert extract_image_from_html("<p>No images here</p>") is None
    assert extract_image_from_html(None) is None
