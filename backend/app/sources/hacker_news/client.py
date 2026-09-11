import asyncio
from typing import Any

import httpx

from app.core.config import settings


class HackerNewsClient:
    BASE_URL = "https://hacker-news.firebaseio.com/v0"

    def __init__(self, timeout: float | None = None):
        self.timeout = timeout or float(settings.HTTP_REQUEST_TIMEOUT)

    async def get_top_story_ids(self, client: httpx.AsyncClient) -> list[int]:
        url = f"{self.BASE_URL}/topstories.json"
        response = await client.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response.json() or []

    async def get_best_story_ids(self, client: httpx.AsyncClient) -> list[int]:
        url = f"{self.BASE_URL}/beststories.json"
        response = await client.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response.json() or []

    async def get_item(self, client: httpx.AsyncClient, item_id: int) -> dict[str, Any] | None:
        url = f"{self.BASE_URL}/item/{item_id}.json"
        try:
            response = await client.get(url, timeout=self.timeout)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None

    async def fetch_stories(
        self,
        story_types: list[str] | None = None,
        limit: int = 30,
        max_concurrency: int = 8,
    ) -> list[dict[str, Any]]:
        if story_types is None:
            story_types = ["top", "best"]

        async with httpx.AsyncClient(
            headers={"User-Agent": "AccioFeed/1.0"},
            timeout=self.timeout,
        ) as client:
            all_ids: list[int] = []
            if "top" in story_types:
                top_ids = await self.get_top_story_ids(client)
                all_ids.extend(top_ids[:limit])
            if "best" in story_types:
                best_ids = await self.get_best_story_ids(client)
                all_ids.extend(best_ids[:limit])

            # Deduplicate IDs preserving order
            unique_ids = list(dict.fromkeys(all_ids))[:limit]

            semaphore = asyncio.Semaphore(max_concurrency)

            async def fetch_with_semaphore(story_id: int) -> dict[str, Any] | None:
                async with semaphore:
                    return await self.get_item(client, story_id)

            tasks = [fetch_with_semaphore(sid) for sid in unique_ids]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            items: list[dict[str, Any]] = []
            for res in results:
                if (
                    isinstance(res, dict)
                    and res.get("type") == "story"
                    and not res.get("deleted", False)
                ):
                    items.append(res)
            return items
