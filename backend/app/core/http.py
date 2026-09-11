import httpx

from app.core.config import settings

DEFAULT_USER_AGENT = "AccioFeed/1.0 (+https://github.com/leogoecking/TechNewsHub; RSS Reader)"


def create_http_client(
    timeout: float | None = None,
    max_connections: int = 50,
    max_keepalive_connections: int = 20,
) -> httpx.AsyncClient:
    """
    Creates a centralized httpx.AsyncClient with unified configuration,
    proper timeouts, connection pooling, and an identifiable User-Agent.
    """
    client_timeout = timeout if timeout is not None else float(settings.HTTP_REQUEST_TIMEOUT)

    limits = httpx.Limits(
        max_connections=max_connections,
        max_keepalive_connections=max_keepalive_connections,
        keepalive_expiry=30.0,
    )

    return httpx.AsyncClient(
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*",
        },
        timeout=httpx.Timeout(client_timeout, connect=5.0),
        limits=limits,
        follow_redirects=True,
    )
