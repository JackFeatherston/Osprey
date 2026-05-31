"""
Trade strategy: daily news sentiment sets BULLISH/BEARISH bias, intraday
technicals confirm direction. Trades fire only when sentiment and technicals
agree.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pandas as pd

from market_analyzer import TradingStrategy
from news_fetcher import get_news_fetcher
from vader_sentiment_analyzer import get_vader_sentiment_analyzer

logger = logging.getLogger(__name__)


class SentimentEnhancedStrategy(TradingStrategy):
    def __init__(
        self,
        sentiment_threshold: float = 0.3,
        volume_multiplier: float = 1.5,
    ):
        super().__init__("Sentiment_Enhanced")
        self.sentiment_threshold = sentiment_threshold
        self.volume_multiplier = volume_multiplier

        self.sentiment_enabled = os.getenv("ENABLE_SENTIMENT_ANALYSIS", "false").lower() == "true"
        self.sentiment_analyzer = get_vader_sentiment_analyzer() if self.sentiment_enabled else None
        logger.info(f"Sentiment analysis {'ENABLED' if self.sentiment_enabled else 'DISABLED'}")

        # symbol -> {"bias": "BULLISH"|"BEARISH"|"NEUTRAL", "score": float, ...}
        self.daily_sentiment_cache: Dict[str, Dict] = {}
        self.last_sentiment_refresh: Optional[datetime] = None
        self.sentiment_cache_ttl = timedelta(hours=24)

    async def refresh_daily_sentiment(self, symbols: List[str]):
        """Refresh strategic sentiment bias for every watchlist symbol."""
        if not self.sentiment_analyzer:
            for symbol in symbols:
                self.daily_sentiment_cache[symbol] = {"bias": "NEUTRAL", "score": 0.0, "timestamp": datetime.now()}
            self.last_sentiment_refresh = datetime.now()
            return

        logger.info(f"Refreshing daily sentiment for {len(symbols)} symbols...")
        news_fetcher = await get_news_fetcher()
        async with news_fetcher:
            for symbol in symbols:
                articles = await news_fetcher.get_news_for_symbol(symbol, max_articles=5)
                score, summary = await self.sentiment_analyzer.get_symbol_sentiment_score(articles)

                if score > self.sentiment_threshold:
                    bias = "BULLISH"
                elif score < -self.sentiment_threshold:
                    bias = "BEARISH"
                else:
                    bias = "NEUTRAL"

                self.daily_sentiment_cache[symbol] = {
                    "bias": bias,
                    "score": score,
                    "article_count": summary.get("article_count", 0),
                    "timestamp": datetime.now(),
                }
                logger.info(f"Sentiment for {symbol}: {bias} (score: {score:+.2f}, articles: {summary.get('article_count', 0)})")

        self.last_sentiment_refresh = datetime.now()

    def needs_sentiment_refresh(self) -> bool:
        if self.last_sentiment_refresh is None:
            return True
        return datetime.now() - self.last_sentiment_refresh >= self.sentiment_cache_ttl

    async def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        if len(data) < 20:
            return None

        sentiment = self.daily_sentiment_cache.get(symbol)
        if not sentiment or sentiment["bias"] == "NEUTRAL":
            return None

        price_trend = self._intraday_price_trend(data)
        volume_signal = self._intraday_volume_signal(data)
        technical_score = self._technical_score(price_trend, volume_signal)

        bias = sentiment["bias"]
        if bias == "BULLISH" and technical_score > 0.01:
            action = "BUY"
        elif bias == "BEARISH" and technical_score < -0.01:
            action = "SELL"
        else:
            return None

        return {
            "action": action,
            "price": float(data["close"].iloc[-1]),
            "reason": self._reasoning(action, bias, sentiment["score"], price_trend, volume_signal, technical_score),
            "sentiment_score": sentiment["score"],
            "sentiment_bias": bias,
            "technical_score": technical_score,
        }

    def _intraday_price_trend(self, data: pd.DataFrame) -> Dict:
        short_window = min(20, len(data))
        short_change = (data["close"].iloc[-1] - data["close"].iloc[-short_window]) / data["close"].iloc[-short_window]

        if len(data) >= 80:
            medium_change = (data["close"].iloc[-1] - data["close"].iloc[-80]) / data["close"].iloc[-80]
        else:
            medium_change = short_change

        if len(data) >= 40:
            sma_40 = data["close"].rolling(window=40).mean().iloc[-1]
            price_vs_sma = (data["close"].iloc[-1] - sma_40) / sma_40
        else:
            price_vs_sma = 0.0

        return {
            "short_term_change": float(short_change),
            "medium_term_change": float(medium_change),
            "price_vs_sma": float(price_vs_sma),
        }

    def _intraday_volume_signal(self, data: pd.DataFrame) -> Dict:
        current_volume = data["volume"].iloc[-1]

        if len(data) >= 40:
            avg_volume = data["volume"].rolling(window=40).mean().iloc[-2]
            volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
            recent = data["volume"].iloc[-20:].mean()
            older = data["volume"].iloc[-40:-20].mean()
            volume_trend = (recent - older) / older if older > 0 else 0.0
        else:
            volume_ratio = 1.0
            volume_trend = 0.0

        return {
            "volume_ratio": float(volume_ratio),
            "volume_trend": float(volume_trend),
            "is_volume_spike": volume_ratio > self.volume_multiplier,
        }

    def _technical_score(self, price_trend: Dict, volume_signal: Dict) -> float:
        score = (
            price_trend["short_term_change"] * 0.4
            + price_trend["medium_term_change"] * 0.3
            + price_trend["price_vs_sma"] * 0.2
        )
        if volume_signal["is_volume_spike"]:
            score += 0.1 if score > 0 else -0.1
        return max(-1.0, min(1.0, score))

    def _reasoning(
        self,
        action: str,
        bias: str,
        sentiment_score: float,
        price_trend: Dict,
        volume_signal: Dict,
        technical_score: float,
    ) -> str:
        strength = "Strong" if abs(sentiment_score) > 0.5 else "Moderate"
        momentum = "upward" if action == "BUY" else "downward"
        direction = "rising" if technical_score > 0 else "falling"
        change_pct = abs(price_trend["short_term_change"]) * 100

        tech_detail = f"intraday price {direction} {change_pct:.1f}%"
        if volume_signal["is_volume_spike"]:
            tech_detail += f" with volume spike of {volume_signal['volume_ratio']:.1f}x average"

        return (
            f"{strength} {bias.lower()} sentiment (score: {sentiment_score:+.2f}) suggests {momentum} momentum.\n\n"
            f"Technical analysis confirms this with {tech_detail}.\n\n"
            f"Technical score: {technical_score:+.2f}"
        )
