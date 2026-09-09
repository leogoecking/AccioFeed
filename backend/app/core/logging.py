import logging
import sys
from typing import Any


class StructuredLogFormatter(logging.Formatter):
    """
    Format logs with structured key=value attributes:
    level=INFO source=hacker_news operation=fetch status=success articles=30 duration=1.24s msg="Fetch completed"
    """

    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, self.datefmt or "%Y-%m-%d %H:%M:%S")
        base = f"[{timestamp}] [{record.levelname}]"

        extra_fields = []
        # Standard structured attributes if provided in record.__dict__
        for key in ("source", "operation", "status", "articles", "duration", "reason"):
            val = getattr(record, key, None)
            if val is not None:
                extra_fields.append(f"{key}={val}")

        structured_str = " ".join(extra_fields)
        msg = record.getMessage()

        if structured_str:
            return f"{base} {structured_str} - {msg}"
        return f"{base} {msg}"


def setup_logging(debug: bool = False) -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if debug else logging.INFO)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(StructuredLogFormatter())
    root_logger.addHandler(console_handler)

    # Suppress verbose noisy third-party logs in debug mode
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def log_event(
    logger: logging.Logger,
    level: int,
    message: str,
    *,
    source: str | None = None,
    operation: str | None = None,
    status: str | None = None,
    articles: int | None = None,
    duration: float | str | None = None,
    reason: str | None = None,
    **extra: Any,
) -> None:
    """Helper to log structured operations consistently across workers and services."""
    duration_str = f"{duration:.2f}s" if isinstance(duration, (int, float)) else duration
    extra_dict: dict[str, Any] = {
        "source": source,
        "operation": operation,
        "status": status,
        "articles": articles,
        "duration": duration_str,
        "reason": reason,
        **extra,
    }
    logger.log(level, message, extra=extra_dict)
