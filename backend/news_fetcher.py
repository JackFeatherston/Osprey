"""NewsAPI client with simple in-memory caching."""

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)

SYMBOL_TO_COMPANY = {
    "AAPL": "Apple",
    "GOOGL": "Google Alphabet",
    "MSFT": "Microsoft",
    "TSLA": "Tesla",
    "NVDA": "Nvidia",
    "AMZN": "Amazon",
    "META": "Meta Facebook",
    "NFLX": "Netflix",
}
CACHE_TTL = timedelta(minutes=30)
RATE_LIMIT_DELAY = 1.0


@dataclass
class NewsArticle:
    title: str
    description: str
    url: str
    published_at: str
    source: str


class NewsFetcher:
    def __init__(self):
        self.api_key = os.getenv("NEWSAPI_KEY")
        if not self.api_key:
            raise ValueError("NEWSAPI_KEY environment variable is required")

        self.cache: Dict[str, Dict] = {}
        self.last_request_time: float = 0.0
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def get_news_for_symbol(self, symbol: str, max_articles: int = 5) -> List[NewsArticle]:
        cached = self.cache.get(symbol)
        if cached and datetime.now() - cached["timestamp"] < CACHE_TTL:
            return cached["articles"][:max_articles]

        articles = await self._fetch(symbol, max_articles)
        if articles:
            self.cache[symbol] = {"articles": articles, "timestamp": datetime.now()}
        return articles[:max_articles]

    async def _fetch(self, symbol: str, max_articles: int) -> List[NewsArticle]:
        if not self.session:
            return []

        await self._throttle()

        params = {
            "q": SYMBOL_TO_COMPANY.get(symbol, symbol),
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": max_articles,
            "from": (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),
            "apiKey": self.api_key,
        }

        async with self.session.get("https://newsapi.org/v2/everything", params=params) as response:
            if response.status != 200:
                logger.warning(f"NewsAPI request failed: {response.status}")
                return []
            data = await response.json()

        return [
            NewsArticle(
                title=a["title"],
                description=a.get("description") or "",
                url=a.get("url", ""),
                published_at=a.get("publishedAt", ""),
                source=a.get("source", {}).get("name", "Unknown"),
            )
            for a in data.get("articles", [])
            if a.get("title") and a.get("description")
        ]

    async def _throttle(self):
        now = asyncio.get_event_loop().time()
        elapsed = now - self.last_request_time
        if elapsed < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - elapsed)
        self.last_request_time = asyncio.get_event_loop().time()


_instance: Optional[NewsFetcher] = None


async def get_news_fetcher() -> NewsFetcher:
    global _instance
    if _instance is None:
        _instance = NewsFetcher()
    return _instance
