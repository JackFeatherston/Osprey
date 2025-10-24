"""
Sentiment-enhanced trading strategy that combines FinBERT sentiment analysis
with technical indicators for trading decisions.
"""

import logging
import pandas as pd
import numpy as np
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from market_analyzer import TradingStrategy
from news_fetcher import get_news_fetcher, NewsArticle
from vader_sentiment_analyzer import get_vader_sentiment_analyzer

logger = logging.getLogger(__name__)

class SentimentEnhancedStrategy(TradingStrategy):
    """
    Trading strategy that combines news sentiment analysis with technical indicators
    """
    
    def __init__(self,
                 sentiment_threshold: float = 0.3,
                 min_articles: int = 2,
                 price_change_window: int = 5,
                 volume_multiplier: float = 1.5):
        super().__init__("Sentiment_Enhanced")

        # Strategy parameters
        self.sentiment_threshold = sentiment_threshold  # Minimum sentiment score for trade
        self.min_articles = min_articles  # Minimum news articles required
        self.price_change_window = price_change_window  # Days to look back for price trends
        self.volume_multiplier = volume_multiplier  # Volume spike threshold

        # Check if sentiment analysis is enabled
        self.sentiment_enabled = os.getenv("ENABLE_SENTIMENT_ANALYSIS", "false").lower() == "true"

        # Initialize VADER sentiment analyzer if enabled
        if self.sentiment_enabled:
            self.sentiment_analyzer = get_vader_sentiment_analyzer()
            logger.info("Sentiment analysis ENABLED using VADER")
        else:
            self.sentiment_analyzer = None
            logger.info("Sentiment analysis DISABLED (set ENABLE_SENTIMENT_ANALYSIS=true to enable)")

        # Daily sentiment cache (strategic direction layer)
        # Maps symbol -> {"bias": "BULLISH"/"BEARISH"/"NEUTRAL", "score": float, "timestamp": datetime}
        self.daily_sentiment_cache = {}
        self.last_sentiment_refresh = None
        self.sentiment_cache_ttl = timedelta(hours=24)  # Refresh daily

    async def refresh_daily_sentiment(self, symbols: List[str]):
        """
        Refresh daily sentiment analysis for all symbols.
        This is the strategic layer that determines BULLISH/BEARISH/NEUTRAL bias.
        Called once per day.
        """
        if not self.sentiment_enabled or not self.sentiment_analyzer:
            logger.info("Sentiment analysis disabled, skipping daily sentiment refresh")
            for symbol in symbols:
                self.daily_sentiment_cache[symbol] = {
                    "bias": "NEUTRAL",
                    "score": 0.0,
                    "timestamp": datetime.now()
                }
            self.last_sentiment_refresh = datetime.now()
            return

        logger.info(f"Refreshing daily sentiment for {len(symbols)} symbols...")

        news_fetcher = await get_news_fetcher()
        async with news_fetcher:
            for symbol in symbols:
                # Fetch recent news articles
                articles = await news_fetcher.get_news_for_symbol(symbol, max_articles=5)

                # Analyze sentiment
                sentiment_score, sentiment_summary = await self.sentiment_analyzer.get_symbol_sentiment_score(articles)

                # Determine sentiment bias based on score
                if sentiment_score > self.sentiment_threshold:
                    bias = "BULLISH"
                elif sentiment_score < -self.sentiment_threshold:
                    bias = "BEARISH"
                else:
                    bias = "NEUTRAL"

                # Cache the sentiment
                self.daily_sentiment_cache[symbol] = {
                    "bias": bias,
                    "score": sentiment_score,
                    "article_count": sentiment_summary.get("article_count", 0),
                    "timestamp": datetime.now()
                }

                logger.info(f"Daily sentiment for {symbol}: {bias} (score: {sentiment_score:+.2f}, articles: {sentiment_summary.get('article_count', 0)})")

        self.last_sentiment_refresh = datetime.now()
        logger.info("Daily sentiment refresh complete")

    def needs_sentiment_refresh(self) -> bool:
        """Check if daily sentiment needs to be refreshed"""
        if self.last_sentiment_refresh is None:
            return True

        time_since_refresh = datetime.now() - self.last_sentiment_refresh
        return time_since_refresh >= self.sentiment_cache_ttl

    async def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        """
        Analyze intraday market data (15-minute bars) with cached daily sentiment.
        This is the tactical layer that determines when to enter trades.
        """
        if len(data) < 20:
            logger.info(f"Insufficient intraday data for {symbol} ({len(data)} bars, need at least 20)")
            return None

        # Get cached daily sentiment bias
        sentiment_data = self.daily_sentiment_cache.get(symbol)
        if not sentiment_data:
            logger.info(f"No cached sentiment for {symbol}, skipping analysis")
            return None

        sentiment_bias = sentiment_data["bias"]
        sentiment_score = sentiment_data["score"]

        # Skip if sentiment is neutral
        if sentiment_bias == "NEUTRAL":
            logger.info(f"Neutral sentiment for {symbol}, skipping trade signal")
            return None

        # Get current market data
        current_price = float(data['close'].iloc[-1])
        current_volume = float(data['volume'].iloc[-1])

        # Calculate intraday technical indicators
        price_trend = self._calculate_intraday_price_trend(data)
        volume_signal = self._calculate_intraday_volume_signal(data)
        technical_score = self._calculate_technical_score(price_trend, volume_signal)

        # Generate trade signal based on sentiment + technical alignment
        signal = await self._generate_aligned_trade_signal(
            symbol=symbol,
            current_price=current_price,
            sentiment_bias=sentiment_bias,
            sentiment_score=sentiment_score,
            price_trend=price_trend,
            volume_signal=volume_signal,
            technical_score=technical_score
        )

        return signal

    def _calculate_intraday_price_trend(self, data: pd.DataFrame) -> Dict:
        """
        Calculate price trend indicators for intraday 15-minute bars.
        Adapted for shorter timeframes: uses bar counts instead of day counts.
        """
        # Short-term trend: last 20 bars (5 hours)
        short_window = min(20, len(data))
        short_change = (data['close'].iloc[-1] - data['close'].iloc[-short_window]) / data['close'].iloc[-short_window]

        # Medium-term trend: last 80 bars (20 hours, roughly 3 trading days)
        if len(data) >= 80:
            medium_change = (data['close'].iloc[-1] - data['close'].iloc[-80]) / data['close'].iloc[-80]
        else:
            medium_change = short_change

        # Simple moving average: 40-bar SMA (10 hours)
        if len(data) >= 40:
            sma_40 = data['close'].rolling(window=40).mean().iloc[-1]
            price_vs_sma = (data['close'].iloc[-1] - sma_40) / sma_40
        else:
            price_vs_sma = 0.0

        return {
            "short_term_change": float(short_change),
            "medium_term_change": float(medium_change),
            "price_vs_sma": float(price_vs_sma)
        }

    def _calculate_intraday_volume_signal(self, data: pd.DataFrame) -> Dict:
        """
        Calculate volume-based signals for intraday 15-minute bars.
        """
        current_volume = data['volume'].iloc[-1]

        # Average volume over past 40 bars
        if len(data) >= 40:
            avg_volume = data['volume'].rolling(window=40).mean().iloc[-2]
            volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
        else:
            volume_ratio = 1.0

        # Volume trend: recent 20 bars vs previous 20 bars
        if len(data) >= 40:
            recent_volume = data['volume'].iloc[-20:].mean()
            older_volume = data['volume'].iloc[-40:-20].mean()
            volume_trend = (recent_volume - older_volume) / older_volume if older_volume > 0 else 0.0
        else:
            volume_trend = 0.0

        return {
            "volume_ratio": float(volume_ratio),
            "volume_trend": float(volume_trend),
            "is_volume_spike": volume_ratio > self.volume_multiplier
        }

    def _calculate_price_trend(self, data: pd.DataFrame) -> Dict:
        """Calculate price trend indicators"""
        # Short-term trend (5-day)
        short_change = (data['close'].iloc[-1] - data['close'].iloc[-self.price_change_window]) / data['close'].iloc[-self.price_change_window]

        # Medium-term trend (if we have enough data)
        if len(data) >= 20:
            medium_change = (data['close'].iloc[-1] - data['close'].iloc[-20]) / data['close'].iloc[-20]
        else:
            medium_change = short_change

        # Simple moving average trend
        if len(data) >= 10:
            sma_10 = data['close'].rolling(window=10).mean().iloc[-1]
            price_vs_sma = (data['close'].iloc[-1] - sma_10) / sma_10
        else:
            price_vs_sma = 0.0

        return {
            "short_term_change": float(short_change),
            "medium_term_change": float(medium_change),
            "price_vs_sma": float(price_vs_sma)
        }
    
    def _calculate_volume_signal(self, data: pd.DataFrame) -> Dict:
        """Calculate volume-based signals"""
        current_volume = data['volume'].iloc[-1]

        # Average volume over past periods
        if len(data) >= 10:
            avg_volume = data['volume'].rolling(window=10).mean().iloc[-2]  # Exclude current day
            volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1.0
        else:
            volume_ratio = 1.0

        # Volume trend
        if len(data) >= 5:
            recent_volume = data['volume'].iloc[-5:].mean()
            older_volume = data['volume'].iloc[-10:-5].mean() if len(data) >= 10 else recent_volume
            volume_trend = (recent_volume - older_volume) / older_volume if older_volume > 0 else 0.0
        else:
            volume_trend = 0.0

        return {
            "volume_ratio": float(volume_ratio),
            "volume_trend": float(volume_trend),
            "is_volume_spike": volume_ratio > self.volume_multiplier
        }
    
    async def _get_sentiment_analysis(self, symbol: str) -> Tuple[float, Dict]:
        """Get sentiment analysis for symbol with caching"""
        # If sentiment analysis is disabled, return neutral sentiment
        if not self.sentiment_enabled or not self.sentiment_analyzer:
            return 0.0, {"article_count": 0, "avg_confidence": 0.0}

        cache_key = f"{symbol}_{datetime.now().strftime('%Y%m%d_%H')}"  # Cache by hour

        # Check cache
        if cache_key in self.sentiment_cache:
            cached_data = self.sentiment_cache[cache_key]
            if datetime.now() - cached_data['timestamp'] < self.cache_ttl:
                return cached_data['sentiment_score'], cached_data['sentiment_summary']

        # Fetch news articles
        news_fetcher = await get_news_fetcher()
        async with news_fetcher:
            articles = await news_fetcher.get_news_for_symbol(symbol, max_articles=5)

        # Analyze sentiment
        sentiment_score, sentiment_summary = await self.sentiment_analyzer.get_symbol_sentiment_score(articles)

        # Cache results
        self.sentiment_cache[cache_key] = {
            'sentiment_score': sentiment_score,
            'sentiment_summary': sentiment_summary,
            'timestamp': datetime.now()
        }

        return sentiment_score, sentiment_summary
    
    async def _generate_trade_signal(self, 
                                   symbol: str,
                                   current_price: float,
                                   price_trend: Dict,
                                   volume_signal: Dict,
                                   sentiment_score: float,
                                   sentiment_summary: Dict) -> Optional[Dict]:
        """Generate trade signal based on combined analysis"""
        
        # Calculate composite scores
        technical_score = self._calculate_technical_score(price_trend, volume_signal)
        confidence_factor = sentiment_summary.get("avg_confidence", 0.5)
        
        # Combined signal strength
        combined_score = (sentiment_score * 0.6) + (technical_score * 0.4)
        
        # Determine action based on thresholds
        action = None

        # If no news data available, use technical analysis only
        if sentiment_summary.get("article_count", 0) == 0:
            logger.info(f"Using technical analysis only for {symbol}")
            logger.info(f"DEBUG {symbol}: technical_score={technical_score}, checking > 0.015 or < -0.015")
            # Technical-only signal criteria (lowered threshold)
            if technical_score > 0.015:  # Lowered threshold for technical-only
                action = "BUY"
                logger.info(f"DEBUG {symbol}: BUY signal triggered")
            elif technical_score < -0.015:
                action = "SELL"
                logger.info(f"DEBUG {symbol}: SELL signal triggered")
        else:
            # Combined sentiment + technical analysis
            # Buy signal criteria (lowered thresholds for more signals)
            if (sentiment_score > 0.1 and
                technical_score > 0.0 and
                combined_score > 0.05):
                action = "BUY"

            # Sell signal criteria (lowered thresholds)
            elif (sentiment_score < -0.1 and
                  technical_score < 0.0 and
                  combined_score < -0.05):
                action = "SELL"
        
        if not action:
            logger.info(f"No trade signal for {symbol}: sentiment={sentiment_score:.3f}, "
                       f"technical={technical_score:.3f}, combined={combined_score:.3f}")
            return None
        
        # Generate structured reasoning
        reasoning = await self._generate_reasoning(
            symbol=symbol,
            action=action,
            sentiment_score=sentiment_score,
            sentiment_summary=sentiment_summary,
            price_trend=price_trend,
            volume_signal=volume_signal,
            technical_score=technical_score,
            combined_score=combined_score
        )
        
        return {
            "action": action,
            "price": current_price,
            "reason": reasoning,
            "sentiment_score": sentiment_score,
            "technical_score": technical_score,
            "combined_score": combined_score,
            "confidence": confidence_factor
        }
    
    def _calculate_technical_score(self, price_trend: Dict, volume_signal: Dict) -> float:
        """Calculate technical analysis score (-1 to +1)"""
        score = 0.0

        # Price trend components
        score += price_trend["short_term_change"] * 0.4
        score += price_trend["medium_term_change"] * 0.3
        score += price_trend["price_vs_sma"] * 0.2

        # Volume components
        if volume_signal["is_volume_spike"]:
            score += 0.1 if score > 0 else -0.1  # Volume confirms direction

        # Normalize to -1 to +1 range
        return max(-1.0, min(1.0, score))

    async def _generate_aligned_trade_signal(self,
                                            symbol: str,
                                            current_price: float,
                                            sentiment_bias: str,
                                            sentiment_score: float,
                                            price_trend: Dict,
                                            volume_signal: Dict,
                                            technical_score: float) -> Optional[Dict]:
        """
        Generate trade signal only when intraday technicals confirm daily sentiment bias.
        BULLISH sentiment + uptrend → BUY
        BEARISH sentiment + downtrend → SELL
        Conflicts → No signal
        """
        action = None

        # BUY signal: BULLISH sentiment confirmed by positive technical score
        if sentiment_bias == "BULLISH" and technical_score > 0.01:
            action = "BUY"
            logger.info(f"BUY signal for {symbol}: BULLISH sentiment confirmed by intraday uptrend (technical: {technical_score:+.3f})")

        # SELL signal: BEARISH sentiment confirmed by negative technical score
        elif sentiment_bias == "BEARISH" and technical_score < -0.01:
            action = "SELL"
            logger.info(f"SELL signal for {symbol}: BEARISH sentiment confirmed by intraday downtrend (technical: {technical_score:+.3f})")

        else:
            logger.info(f"No signal for {symbol}: sentiment={sentiment_bias}, technical={technical_score:+.3f} (not aligned)")
            return None

        # Generate reasoning
        reasoning = await self._generate_aligned_reasoning(
            symbol=symbol,
            action=action,
            sentiment_bias=sentiment_bias,
            sentiment_score=sentiment_score,
            price_trend=price_trend,
            volume_signal=volume_signal,
            technical_score=technical_score
        )

        return {
            "action": action,
            "price": current_price,
            "reason": reasoning,
            "sentiment_score": sentiment_score,
            "sentiment_bias": sentiment_bias,
            "technical_score": technical_score
        }

    async def _generate_aligned_reasoning(self,
                                         symbol: str,
                                         action: str,
                                         sentiment_bias: str,
                                         sentiment_score: float,
                                         price_trend: Dict,
                                         volume_signal: Dict,
                                         technical_score: float) -> str:
        """Generate human-readable reasoning for aligned trade signals"""

        # Sentiment component
        sentiment_strength = "strong" if abs(sentiment_score) > 0.5 else "moderate"
        price_direction = "rising" if technical_score > 0 else "falling"
        price_change_pct = abs(price_trend["short_term_change"]) * 100

        # Build natural, readable reasoning with clear sections
        parts = []

        # Opening statement with sentiment analysis
        momentum_direction = "upward" if action == "BUY" else "downward"
        parts.append(f"{sentiment_strength.capitalize()} {sentiment_bias.lower()} sentiment (score: {sentiment_score:+.2f}) suggests {momentum_direction} momentum.")

        # Technical confirmation with details
        tech_detail = f"intraday price {price_direction} {price_change_pct:.1f}%"
        if volume_signal["is_volume_spike"]:
            tech_detail += f" with volume spike of {volume_signal['volume_ratio']:.1f}x average"

        parts.append(f"\n\nTechnical analysis confirms this with {tech_detail}.")

        # Technical score summary
        parts.append(f"\n\nTechnical score: {technical_score:+.2f}")

        return "".join(parts)

    async def _generate_reasoning(self,
                                symbol: str,
                                action: str,
                                sentiment_score: float,
                                sentiment_summary: Dict,
                                price_trend: Dict,
                                volume_signal: Dict,
                                technical_score: float,
                                combined_score: float) -> str:
        """Generate human-readable reasoning for the trade decision"""

        # Sentiment analysis
        sentiment_text = "positive" if sentiment_score > 0 else "negative" if sentiment_score < 0 else "neutral"
        sentiment_strength = "strong" if abs(sentiment_score) > 0.5 else "moderate" if abs(sentiment_score) > 0.2 else "weak"

        # Technical indicators
        price_direction = "rising" if price_trend["short_term_change"] > 0 else "falling"
        price_change_pct = abs(price_trend["short_term_change"]) * 100
        signal_strength = "strong" if abs(combined_score) > 0.4 else "moderate"

        # Build natural, readable reasoning with clear sections
        parts = []

        # News sentiment analysis
        article_text = "article" if sentiment_summary['article_count'] == 1 else "articles"
        parts.append(f"News analysis shows {sentiment_strength} {sentiment_text} sentiment (score: {sentiment_score:+.2f}) based on {sentiment_summary['article_count']} recent {article_text}.")

        # Technical analysis
        tech_detail = f"price {price_direction} {price_change_pct:.1f}% recently"
        if volume_signal["is_volume_spike"]:
            tech_detail += f" with volume spike of {volume_signal['volume_ratio']:.1f}x average"

        parts.append(f"\n\nTechnical indicators show {tech_detail}.")

        # Combined assessment
        momentum_direction = "upward" if action == "BUY" else "downward"
        parts.append(f"\n\nCombined analysis indicates {signal_strength} {momentum_direction} momentum (combined score: {combined_score:+.2f}).")

        return "".join(parts)