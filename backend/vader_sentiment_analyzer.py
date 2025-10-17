"""
VADER-based sentiment analysis for financial news.
Optimized for financial news headlines and articles.
"""

import logging
from typing import Dict, List, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache
from news_fetcher import NewsArticle

logger = logging.getLogger(__name__)

@dataclass
class SentimentResult:
    """Data class for sentiment analysis results"""
    text: str
    label: str  # "positive", "negative", "neutral"
    score: float  # confidence score 0-1
    normalized_score: float  # -1 to +1 scale

class VaderSentimentAnalyzer:
    """
    VADER-based sentiment analyzer optimized for financial news.
    """

    def __init__(self):
        self.analyzer = None
        self.model_loaded = False
        self.cache = {}
        self.cache_ttl = timedelta(hours=1)

        # Financial sentiment boosters (words that amplify sentiment in finance)
        self.financial_boosters = {
            'surge': 0.3, 'soar': 0.3, 'plunge': -0.3, 'crash': -0.4,
            'rally': 0.3, 'tumble': -0.3, 'spike': 0.2, 'slump': -0.3,
            'boom': 0.3, 'bust': -0.4, 'bullish': 0.3, 'bearish': -0.3,
            'upgrade': 0.2, 'downgrade': -0.3, 'beat': 0.2, 'miss': -0.2,
            'record': 0.2, 'high': 0.15, 'low': -0.15, 'profit': 0.2,
            'loss': -0.2, 'growth': 0.2, 'decline': -0.2, 'gain': 0.2,
            'drop': -0.2, 'rise': 0.2, 'fall': -0.2, 'climb': 0.2
        }

    def _load_model(self):
        """Lazy load the VADER sentiment analyzer"""
        if self.model_loaded:
            return

        logger.info("Loading VADER sentiment analyzer")
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
            self.analyzer = SentimentIntensityAnalyzer()
            self.model_loaded = True
            logger.info("VADER sentiment analyzer loaded successfully")
        except ImportError:
            logger.error("vaderSentiment not installed. Run: pip install vaderSentiment")
            raise RuntimeError("vaderSentiment package not found")

    def _adjust_for_financial_context(self, text: str, base_score: float) -> float:
        """Adjust sentiment score based on financial keywords"""
        text_lower = text.lower()
        adjustment = 0.0

        for word, boost in self.financial_boosters.items():
            if word in text_lower:
                adjustment += boost

        # Clip adjustment to reasonable bounds
        adjustment = max(-0.5, min(0.5, adjustment))

        # Combine with base score
        adjusted_score = base_score + adjustment
        return max(-1.0, min(1.0, adjusted_score))

    def _normalize_sentiment_score(self, vader_scores: Dict) -> Tuple[str, float, float]:
        """
        Convert VADER compound score to our format

        VADER compound score ranges from -1 (very negative) to +1 (very positive)
        """
        compound = vader_scores['compound']

        # Determine label based on compound score
        if compound >= 0.05:
            label = "positive"
            confidence = abs(compound)
        elif compound <= -0.05:
            label = "negative"
            confidence = abs(compound)
        else:
            label = "neutral"
            confidence = 1.0 - abs(compound)

        # Normalized score is just the compound score (-1 to +1)
        normalized_score = compound

        return label, confidence, normalized_score

    @lru_cache(maxsize=200)
    def _cached_analyze_text(self, text: str) -> SentimentResult:
        """Cached sentiment analysis for repeated texts"""
        return self._analyze_text_uncached(text)

    def _analyze_text_uncached(self, text: str) -> SentimentResult:
        """Analyze sentiment of a single text"""
        if not self.model_loaded:
            self._load_model()

        if not self.analyzer:
            raise RuntimeError("VADER analyzer failed to load")

        # Clean and analyze text
        clean_text = text.strip()[:500]

        # Get VADER scores
        vader_scores = self.analyzer.polarity_scores(clean_text)

        # Convert to our format
        label, confidence, base_normalized_score = self._normalize_sentiment_score(vader_scores)

        # Adjust for financial context
        adjusted_score = self._adjust_for_financial_context(clean_text, base_normalized_score)

        return SentimentResult(
            text=clean_text,
            label=label,
            score=confidence,
            normalized_score=adjusted_score
        )

    async def analyze_news_articles(self, articles: List[NewsArticle]) -> List[SentimentResult]:
        """Analyze sentiment of multiple news articles"""
        if not articles:
            return []

        results = []

        for article in articles:
            # Combine title and description for better analysis
            # Title has more weight in financial news
            combined_text = f"{article.title}. {article.description}"

            # Use cached analysis if available
            sentiment = self._cached_analyze_text(combined_text)
            results.append(sentiment)

        logger.info(f"Analyzed sentiment for {len(results)} articles using VADER")
        return results

    async def get_symbol_sentiment_score(self, articles: List[NewsArticle]) -> Tuple[float, Dict]:
        """Get overall sentiment score for a symbol from its news articles"""
        if not articles:
            return 0.0, {"article_count": 0, "avg_confidence": 0.0}

        sentiments = await self.analyze_news_articles(articles)

        if not sentiments:
            return 0.0, {"article_count": 0, "avg_confidence": 0.0}

        # Calculate weighted average sentiment
        # Recent articles get slightly more weight
        total_weighted_score = 0.0
        total_weight = 0.0

        for i, sentiment in enumerate(sentiments):
            # Newer articles (earlier in list) get slightly more weight
            recency_weight = 1.0 + (0.1 * (len(sentiments) - i) / len(sentiments))
            weight = sentiment.score * recency_weight

            total_weighted_score += sentiment.normalized_score * weight
            total_weight += weight

        if total_weight == 0:
            avg_sentiment = 0.0
        else:
            avg_sentiment = total_weighted_score / total_weight

        # Calculate average confidence
        avg_confidence = sum(s.score for s in sentiments) / len(sentiments)

        # Create summary statistics
        positive_count = sum(1 for s in sentiments if s.label == "positive")
        negative_count = sum(1 for s in sentiments if s.label == "negative")
        neutral_count = len(sentiments) - positive_count - negative_count

        summary = {
            "article_count": len(sentiments),
            "avg_confidence": avg_confidence,
            "positive_articles": positive_count,
            "negative_articles": negative_count,
            "neutral_articles": neutral_count,
            "sentiment_breakdown": [
                {"label": s.label, "score": s.normalized_score, "confidence": s.score}
                for s in sentiments
            ]
        }

        logger.info(f"Symbol sentiment: {avg_sentiment:.3f} from {len(sentiments)} articles "
                   f"(+{positive_count}, -{negative_count}, ={neutral_count})")

        return avg_sentiment, summary

    def clear_cache(self):
        """Clear the sentiment analysis cache"""
        self._cached_analyze_text.cache_clear()
        logger.info("VADER sentiment analysis cache cleared")

# Singleton instance
vader_analyzer_instance = None

def get_vader_sentiment_analyzer() -> VaderSentimentAnalyzer:
    """Get or create VADER sentiment analyzer instance"""
    global vader_analyzer_instance
    if vader_analyzer_instance is None:
        vader_analyzer_instance = VaderSentimentAnalyzer()
    return vader_analyzer_instance
