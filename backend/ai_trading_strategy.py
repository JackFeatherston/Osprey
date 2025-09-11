"""
Sentiment-enhanced trading strategy that combines FinBERT sentiment analysis
with technical indicators for trading decisions.
"""

import logging
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from ai_engine import TradingStrategy
from news_fetcher import get_news_fetcher, NewsArticle
from finbert_news_analyzer import get_sentiment_analyzer

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
        
        # Initialize services
        self.sentiment_analyzer = get_sentiment_analyzer()
        
        # Cache for sentiment analysis to avoid repeated API calls
        self.sentiment_cache = {}
        self.cache_ttl = timedelta(minutes=30)
    
    async def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        """
        Analyze market data combined with news sentiment to generate trade signals
        """
        if len(data) < self.price_change_window:
            logger.info(f"Insufficient price data for {symbol} ({len(data)} bars)")
            return None
        
        try:
            # Get current market data
            current_price = float(data['close'].iloc[-1])
            current_volume = float(data['volume'].iloc[-1])
            
            # Calculate basic technical indicators
            price_trend = self._calculate_price_trend(data)
            volume_signal = self._calculate_volume_signal(data)
            
            # Get news sentiment
            sentiment_score, sentiment_summary = await self._get_sentiment_analysis(symbol)
            
            # Check if we have enough news data
            if sentiment_summary["article_count"] < self.min_articles:
                logger.info(f"Insufficient news articles for {symbol} ({sentiment_summary['article_count']} articles)")
                return None
            
            # Generate trade signal based on combined analysis
            signal = await self._generate_trade_signal(
                symbol=symbol,
                current_price=current_price,
                price_trend=price_trend,
                volume_signal=volume_signal,
                sentiment_score=sentiment_score,
                sentiment_summary=sentiment_summary
            )
            
            return signal
            
        except Exception as e:
            logger.error(f"Error analyzing {symbol}: {e}")
            return None
    
    def _calculate_price_trend(self, data: pd.DataFrame) -> Dict:
        """Calculate price trend indicators"""
        try:
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
        except Exception as e:
            logger.error(f"Error calculating price trend: {e}")
            return {"short_term_change": 0.0, "medium_term_change": 0.0, "price_vs_sma": 0.0}
    
    def _calculate_volume_signal(self, data: pd.DataFrame) -> Dict:
        """Calculate volume-based signals"""
        try:
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
        except Exception as e:
            logger.error(f"Error calculating volume signal: {e}")
            return {"volume_ratio": 1.0, "volume_trend": 0.0, "is_volume_spike": False}
    
    async def _get_sentiment_analysis(self, symbol: str) -> Tuple[float, Dict]:
        """Get sentiment analysis for symbol with caching"""
        cache_key = f"{symbol}_{datetime.now().strftime('%Y%m%d_%H')}"  # Cache by hour
        
        # Check cache
        if cache_key in self.sentiment_cache:
            cached_data = self.sentiment_cache[cache_key]
            if datetime.now() - cached_data['timestamp'] < self.cache_ttl:
                return cached_data['sentiment_score'], cached_data['sentiment_summary']
        
        try:
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
            
        except Exception as e:
            logger.error(f"Error getting sentiment analysis for {symbol}: {e}")
            return 0.0, {"article_count": 0, "avg_confidence": 0.0}
    
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
        quantity = 10  # Default quantity
        
        # Buy signal criteria
        if (sentiment_score > self.sentiment_threshold and 
            technical_score > 0.1 and 
            combined_score > 0.25):
            action = "BUY"
            
        # Sell signal criteria  
        elif (sentiment_score < -self.sentiment_threshold and 
              technical_score < -0.1 and 
              combined_score < -0.25):
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
            "quantity": quantity,
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
        
        # Sentiment reasoning
        sentiment_text = "POSITIVE" if sentiment_score > 0 else "NEGATIVE" if sentiment_score < 0 else "NEUTRAL"
        sentiment_strength = "strong" if abs(sentiment_score) > 0.5 else "moderate" if abs(sentiment_score) > 0.2 else "weak"
        
        sentiment_reason = f"News sentiment: {sentiment_strength} {sentiment_text} ({sentiment_score:+.2f}) from {sentiment_summary['article_count']} articles"
        
        # Technical reasoning
        price_direction = "rising" if price_trend["short_term_change"] > 0 else "falling"
        price_change_pct = abs(price_trend["short_term_change"]) * 100
        
        technical_reason = f"Technical: price {price_direction} {price_change_pct:.1f}% recently"
        
        if volume_signal["is_volume_spike"]:
            technical_reason += f", volume spike {volume_signal['volume_ratio']:.1f}x average"
        
        # Combined reasoning
        signal_strength = "strong" if abs(combined_score) > 0.4 else "moderate"
        
        full_reason = f"[{signal_strength.upper()} {action}] {sentiment_reason} | {technical_reason} | Combined score: {combined_score:+.2f}"
        
        return full_reason