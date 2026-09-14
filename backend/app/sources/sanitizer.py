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


def sanitize_editorial_content(content: str | None) -> str | None:
    """Sanitizes editorial content (Markdown or HTML) by decomposing dangerous tags

    and neutralizing javascript:/data: URLs while preserving rich editorial structure.
    """
    if not content or not content.strip():
        return None

    cleaned = content

    # 1. Neutralize javascript: or data: in markdown links [text](javascript:...)
    cleaned = re.sub(
        r"\[([^\]]+)\]\((javascript|data):[^\)]*\)",
        r"[\1](#)",
        cleaned,
        flags=re.IGNORECASE,
    )

    # 2. Decompose dangerous HTML tags if HTML fragments are embedded
    if "<" in cleaned and ">" in cleaned:
        soup = BeautifulSoup(cleaned, "html.parser")
        for tag in soup.find_all(DANGEROUS_TAGS):
            tag.decompose()

        # Remove inline event handlers from all remaining tags
        for tag in soup.find_all(True):
            for attr in list(tag.attrs.keys()):
                if attr.lower().startswith("on") or attr.lower() in ("formaction", "action"):
                    del tag.attrs[attr]
                elif attr.lower() in ("href", "src"):
                    val = str(tag.attrs[attr]).strip().lower()
                    if val.startswith("javascript:") or val.startswith("data:"):
                        tag.attrs[attr] = "#"

        cleaned = str(soup)

    # 3. Collapse excessive empty newlines (more than 2 consecutive blank lines)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    return cleaned or None
