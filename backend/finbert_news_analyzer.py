"""
FinBERT-based sentiment analysis for financial news.
Optimized for EC2 free tier with memory management and caching.
"""

import logging
import os
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import asyncio
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

class SentimentAnalyzer:
    """FinBERT-based sentiment analyzer with memory optimization"""
    
    def __init__(self, model_name: str = "ProsusAI/finbert"):
        self.model_name = model_name
        self.pipeline = None
        self.model_loaded = False
        self.cache = {}  
        self.cache_ttl = timedelta(hours=1)
        
    def _load_model(self):
        """Lazy load the FinBERT model"""
        if self.model_loaded:
            return

        logger.info(f"Loading FinBERT model: {self.model_name}")
        from transformers import pipeline

        # Load model with memory optimizations
        self.pipeline = pipeline(
            "sentiment-analysis",
            model=self.model_name,
            device=-1,  # Use CPU (more memory efficient than GPU on small instance)
            truncation=True,
            max_length=512  # Limit input length
        )

        self.model_loaded = True
        logger.info("FinBERT model loaded successfully")
    
    def _normalize_sentiment_score(self, label: str, score: float) -> float:
        """Convert sentiment to -1 to +1 scale"""
        if label.lower() == "positive":
            return score
        elif label.lower() == "negative":
            return -score
        else:  # neutral
            return 0.0
    
    @lru_cache(maxsize=100)
    def _cached_analyze_text(self, text: str) -> SentimentResult:
        """Cached sentiment analysis for repeated texts"""
        return self._analyze_text_uncached(text)
    
    def _analyze_text_uncached(self, text: str) -> SentimentResult:
        """Analyze sentiment of a single text"""
        if not self.model_loaded:
            self._load_model()

        if not self.pipeline:
            raise RuntimeError("FinBERT model failed to load")

        # Clean and truncate text
        clean_text = text.strip()[:500]

        result = self.pipeline(clean_text)[0]
        label = result['label'].lower()
        score = result['score']

        # Map FinBERT labels to standard format
        if label in ['positive', 'bullish']:
            standard_label = "positive"
        elif label in ['negative', 'bearish']:
            standard_label = "negative"
        else:
            standard_label = "neutral"

        normalized_score = self._normalize_sentiment_score(standard_label, score)

        return SentimentResult(
            text=clean_text,
            label=standard_label,
            score=score,
            normalized_score=normalized_score
        )
    
    async def analyze_news_articles(self, articles: List[NewsArticle]) -> List[SentimentResult]:
        """Analyze sentiment of multiple news articles"""
        if not articles:
            return []
        
        results = []
        
        for article in articles:
            # Combine title and description for better analysis
            combined_text = f"{article.title}. {article.description}"
            
            # Use cached analysis if available
            sentiment = self._cached_analyze_text(combined_text)
            results.append(sentiment)
        
        logger.info(f"Analyzed sentiment for {len(results)} articles")
        return results
    
    async def get_symbol_sentiment_score(self, articles: List[NewsArticle]) -> Tuple[float, Dict]:
        """Get overall sentiment score for a symbol from its news articles"""
        if not articles:
            return 0.0, {"article_count": 0, "avg_confidence": 0.0}
        
        sentiments = await self.analyze_news_articles(articles)
        
        if not sentiments:
            return 0.0, {"article_count": 0, "avg_confidence": 0.0}
        
        # Calculate weighted average sentiment
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for sentiment in sentiments:
            # Weight by confidence score
            weight = sentiment.score
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
        logger.info("Sentiment analysis cache cleared")

# Singleton instance
sentiment_analyzer_instance: Optional[SentimentAnalyzer] = None

def get_sentiment_analyzer() -> SentimentAnalyzer:
    """Get or create sentiment analyzer instance"""
    global sentiment_analyzer_instance
    if sentiment_analyzer_instance is None:
        sentiment_analyzer_instance = SentimentAnalyzer()
    return sentiment_analyzer_instance