"""
News fetching service for retrieving recent financial news.
Optimized for EC2 free tier with caching and rate limiting.
"""

import asyncio
import aiohttp
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)

@dataclass
class NewsArticle:
    """Data class for news articles"""
    title: str
    description: str
    url: str
    published_at: str
    source: str

class NewsCache:
    """Simple in-memory cache for news articles"""
    
    def __init__(self, ttl_minutes: int = 30):
        self.cache: Dict[str, Dict] = {}
        self.ttl_minutes = ttl_minutes
    
    def get(self, symbol: str) -> Optional[List[NewsArticle]]:
        """Get cached news for symbol"""
        if symbol in self.cache:
            cached_data = self.cache[symbol]
            cache_time = datetime.fromisoformat(cached_data['timestamp'])
            
            if datetime.now() - cache_time < timedelta(minutes=self.ttl_minutes):
                return cached_data['articles']
        
        return None
    
    def set(self, symbol: str, articles: List[NewsArticle]):
        """Cache news articles for symbol"""
        self.cache[symbol] = {
            'articles': articles,
            'timestamp': datetime.now().isoformat()
        }
    
    def clear_expired(self):
        """Remove expired cache entries"""
        current_time = datetime.now()
        expired_keys = []
        
        for symbol, data in self.cache.items():
            cache_time = datetime.fromisoformat(data['timestamp'])
            if current_time - cache_time >= timedelta(minutes=self.ttl_minutes):
                expired_keys.append(symbol)
        
        for key in expired_keys:
            del self.cache[key]

class NewsFetcher:
    """News fetcher service with rate limiting and caching"""

    # Mapping of stock symbols to company names for better news search
    SYMBOL_TO_COMPANY = {
        "AAPL": "Apple",
        "GOOGL": "Google Alphabet",
        "MSFT": "Microsoft",
        "TSLA": "Tesla",
        "NVDA": "Nvidia",
        "AMZN": "Amazon",
        "META": "Meta Facebook",
        "NFLX": "Netflix"
    }

    def __init__(self):
        self.newsapi_key = os.getenv("NEWSAPI_KEY")
        if not self.newsapi_key:
            raise ValueError("NEWSAPI_KEY environment variable is required")

        self.cache = NewsCache(ttl_minutes=30)
        self.rate_limit_delay = 1.0  # Delay between API calls
        self.last_request_time = 0
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def get_news_for_symbol(self, symbol: str, max_articles: int = 5) -> List[NewsArticle]:
        """Get recent news articles for a stock symbol"""
        # Check cache first
        cached_articles = self.cache.get(symbol)
        if cached_articles:
            logger.info(f"Using cached news for {symbol} ({len(cached_articles)} articles)")
            return cached_articles[:max_articles]

        # Fetch new articles from NewsAPI
        articles = await self._fetch_from_newsapi(symbol, max_articles)

        # Cache the results
        if articles:
            self.cache.set(symbol, articles)
            logger.info(f"Fetched and cached {len(articles)} articles for {symbol}")

        return articles[:max_articles]
    
    async def _fetch_from_newsapi(self, symbol: str, max_articles: int) -> List[NewsArticle]:
        """Fetch news from NewsAPI"""
        if not self.session:
            return []

        # Rate limiting
        await self._rate_limit()

        # Use company name for broader search, fallback to symbol
        company_name = self.SYMBOL_TO_COMPANY.get(symbol, symbol)
        query = company_name

        url = "https://newsapi.org/v2/everything"
        params = {
            "q": query,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": max_articles,
            "from": (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),
            "apiKey": self.newsapi_key
        }

        async with self.session.get(url, params=params) as response:
            if response.status != 200:
                logger.warning(f"NewsAPI request failed with status {response.status}")
                return []

            data = await response.json()
            articles = []

            for article in data.get("articles", []):
                if article.get("title") and article.get("description"):
                    articles.append(NewsArticle(
                        title=article["title"],
                        description=article["description"] or "",
                        url=article.get("url", ""),
                        published_at=article.get("publishedAt", ""),
                        source=article.get("source", {}).get("name", "Unknown")
                    ))

            return articles
    
    
    async def _rate_limit(self):
        """Simple rate limiting to avoid hitting API limits"""
        current_time = asyncio.get_event_loop().time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.rate_limit_delay:
            await asyncio.sleep(self.rate_limit_delay - time_since_last)
        
        self.last_request_time = asyncio.get_event_loop().time()
    
    async def get_news_for_symbols(self, symbols: List[str], max_articles: int = 3) -> Dict[str, List[NewsArticle]]:
        """Get news for multiple symbols efficiently"""
        results = {}

        # Process symbols in batches to respect rate limits
        for symbol in symbols:
            articles = await self.get_news_for_symbol(symbol, max_articles)
            results[symbol] = articles

        # Clean up expired cache entries
        self.cache.clear_expired()

        return results

# Singleton instance
news_fetcher_instance: Optional[NewsFetcher] = None

async def get_news_fetcher() -> NewsFetcher:
    """Get or create news fetcher instance"""
    global news_fetcher_instance
    if news_fetcher_instance is None:
        news_fetcher_instance = NewsFetcher()
    return news_fetcher_instance