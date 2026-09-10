import urllib.parse

TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_name",
    "utm_cid",
    "utm_reader",
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "msclkid",
    "mc_cid",
    "mc_eid",
    "_hsenc",
    "_hsmi",
    "ref_src",
    "ref_url",
}


def canonicalize_url(url: str) -> str:
    """
    Canonicalizes a URL by:
    1. Parsing scheme and host to lowercase.
    2. Removing common tracking query parameters (utm_*, fbclid, etc.).
    3. Preserving functional query parameters (e.g. id=123, article=456) in deterministic sorted order.
    4. Removing trailing fragments (#...).
    5. Normalizing path (stripping trailing slash unless root).
    """
    if not url:
        return ""

    parsed = urllib.parse.urlsplit(url.strip())
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Normalize default ports
    if (scheme == "http" and netloc.endswith(":80")) or (
        scheme == "https" and netloc.endswith(":443")
    ):
        netloc = netloc.rsplit(":", 1)[0]

    # Normalize path
    path = parsed.path
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    if not path:
        path = "/"

    # Filter and sort query parameters
    query_params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    filtered_params = [(k, v) for k, v in query_params if k.lower() not in TRACKING_PARAMS]
    # Sort for deterministic representation
    filtered_params.sort(key=lambda x: x[0])

    new_query = urllib.parse.urlencode(filtered_params)

    # Do not include fragments
    return urllib.parse.urlunsplit((scheme, netloc, path, new_query, ""))
