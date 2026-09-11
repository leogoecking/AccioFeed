import ipaddress
import socket
import urllib.parse

import httpx

MAX_FEED_BYTES = 5 * 1024 * 1024  # 5 Megabytes max
MAX_REDIRECTS = 3
DEFAULT_FEED_TIMEOUT = 10.0  # 10 seconds max

FORBIDDEN_PROTOCOLS = {"file", "ftp", "gopher", "data", "javascript", "mailto", "ssh"}
ALLOWED_PROTOCOLS = {"http", "https"}


class SSRFValidationError(Exception):
    """Raised when a URL points to an internal, loopback, or non-routable resource."""

    pass


def is_forbidden_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """
    Checks if an IP address is internal, private, loopback, link-local,
    reserved, multicast, unspecified, or cloud metadata.
    """
    if (
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        return True

    # Cloud metadata services
    if str(ip) in ("169.254.169.254", "169.254.170.2"):
        return True

    # Check for IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return is_forbidden_ip(ip.ipv4_mapped)

    return False


def validate_url_ssrf(url_str: str) -> str:
    """
    Validates a URL against Server-Side Request Forgery (SSRF).
    Verifies:
    1. Scheme is http or https.
    2. Hostname exists.
    3. Literal IPs or DNS-resolved IPs do not fall into private/internal ranges.
    Returns the validated URL string or raises SSRFValidationError.
    """
    if not url_str or not isinstance(url_str, str):
        raise SSRFValidationError("URL não fornecida ou inválida.")

    parsed = urllib.parse.urlparse(url_str.strip())
    scheme = parsed.scheme.lower()

    if scheme not in ALLOWED_PROTOCOLS:
        raise SSRFValidationError(
            f"Protocolo '{scheme}' não é permitido. Apenas HTTP e HTTPS são aceitos."
        )

    host = parsed.hostname
    if not host:
        raise SSRFValidationError("URL sem nome de host ou domínio válido.")

    # 1. Quick check for obvious localhost/loopback representations
    host_lower = host.lower().strip("[]")
    if host_lower in ("localhost", "0.0.0.0", "127.0.0.1", "::1", "ip6-localhost", "ip6-loopback"):
        raise SSRFValidationError(f"Acesso a '{host}' não é permitido (host local).")

    # 2. Check if host is direct IP literal
    try:
        ip = ipaddress.ip_address(host_lower)
        if is_forbidden_ip(ip):
            raise SSRFValidationError(f"O IP '{host}' pertence a uma rede privada ou reservada.")
        return url_str
    except ValueError:
        # Not a direct IP literal; proceed to DNS resolution
        pass

    # 3. DNS Resolution check (prevents private network access behind hostnames)
    try:
        # Resolve all addresses (IPv4 and IPv6)
        addr_infos = socket.getaddrinfo(
            host, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM
        )
    except socket.gaierror as e:
        raise SSRFValidationError(f"Não foi possível resolver o domínio '{host}': {e}") from e

    if not addr_infos:
        raise SSRFValidationError(f"Nenhum endereço IP retornado para o domínio '{host}'.")

    for addr_info in addr_infos:
        ip_str = addr_info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
            if is_forbidden_ip(ip):
                raise SSRFValidationError(
                    f"O domínio '{host}' resolve para endereço de rede interna ou reservada ({ip_str})."
                )
        except ValueError:
            continue

    return url_str


async def safe_fetch_feed(
    url: str,
    max_redirects: int = MAX_REDIRECTS,
    max_bytes: int = MAX_FEED_BYTES,
    timeout: float = DEFAULT_FEED_TIMEOUT,
    user_agent: str = "AccioFeed/1.0 (+https://github.com/leogoecking/TechNewsHub; RSS Reader)",
) -> bytes:
    """
    Safely fetches a remote feed with strict SSRF re-validation on every redirect,
    response size capping, and timeout.
    """
    current_url = url
    redirects_count = 0

    limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)
    async with httpx.AsyncClient(
        follow_redirects=False,
        timeout=httpx.Timeout(timeout, connect=5.0),
        limits=limits,
        headers={
            "User-Agent": user_agent,
            "Accept": "application/rss+xml, application/atom+xml, text/xml, application/xml, */*",
        },
    ) as client:
        while True:
            # Re-validate every step against SSRF
            validated_url = validate_url_ssrf(current_url)

            response = await client.get(validated_url)

            # Handle redirects manually to re-validate destination URL
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location:
                    raise ValueError(
                        f"Redirecionamento HTTP {response.status_code} sem cabeçalho Location."
                    )

                redirects_count += 1
                if redirects_count > max_redirects:
                    raise ValueError(
                        f"Número excessivo de redirecionamentos (máximo {max_redirects})."
                    )

                # Resolve relative URL against current URL
                current_url = urllib.parse.urljoin(current_url, location)
                continue

            response.raise_for_status()

            # Enforce size limit
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > max_bytes:
                raise ValueError(
                    f"O feed excede o limite máximo permitido de {max_bytes // (1024 * 1024)}MB."
                )

            content = response.content
            if len(content) > max_bytes:
                raise ValueError(
                    f"O feed excede o limite máximo permitido de {max_bytes // (1024 * 1024)}MB."
                )

            return content
