import asyncio

_global_sync_lock = asyncio.Lock()


def get_sync_lock() -> asyncio.Lock:
    """Returns the process-wide lock for manual synchronization."""
    return _global_sync_lock
