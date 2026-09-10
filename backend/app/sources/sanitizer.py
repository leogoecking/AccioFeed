import re

from bs4 import BeautifulSoup

DANGEROUS_TAGS = {
    "script",
    "iframe",
    "object",
    "embed",
    "style",
    "applet",
    "meta",
    "link",
    "form",
    "input",
    "button",
    "svg",
    "canvas",
}


def sanitize_text(raw_text: str | None, max_length: int | None = None) -> str | None:
    """
    Extracts plain, clean text from raw string/HTML by removing all markup,
    scripts, and normalizing whitespace.
    """
    if not raw_text:
        return None

    soup = BeautifulSoup(raw_text, "html.parser")

    # Decompose dangerous tags completely
    for tag in soup.find_all(DANGEROUS_TAGS):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    # Normalize multiple whitespace
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return None

    if max_length and len(text) > max_length:
        # Truncate at word boundary
        truncated = text[:max_length].rsplit(" ", 1)[0]
        return f"{truncated}..."

    return text


def extract_image_from_html(raw_html: str | None) -> str | None:
    """
    Extracts the first valid HTTP/HTTPS image URL from HTML img tags.
    """
    if not raw_html:
        return None

    soup = BeautifulSoup(raw_html, "html.parser")
    for img in soup.find_all("img"):
        src = img.get("src")
        if src and (src.startswith("http://") or src.startswith("https://")):
            # Ignore tiny tracking pixels (1x1)
            width = img.get("width")
            height = img.get("height")
            if width in ("1", 1, "0", 0) or height in ("1", 1, "0", 0):
                continue
            return src.strip()
    return None
