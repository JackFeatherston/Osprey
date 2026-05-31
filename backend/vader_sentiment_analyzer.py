"""VADER-based sentiment analysis with financial keyword boosters."""

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List, Tuple

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from news_fetcher import NewsArticle

logger = logging.getLogger(__name__)

# Financial words VADER under-weights; positive=bullish, negative=bearish.
FINANCIAL_BOOSTERS = {
    "surge": 0.3, "soar": 0.3, "plunge": -0.3, "crash": -0.4,
    "rally": 0.3, "tumble": -0.3, "spike": 0.2, "slump": -0.3,
    "boom": 0.3, "bust": -0.4, "bullish": 0.3, "bearish": -0.3,
    "upgrade": 0.2, "downgrade": -0.3, "beat": 0.2, "miss": -0.2,
    "record": 0.2, "high": 0.15, "low": -0.15, "profit": 0.2,
    "loss": -0.2, "growth": 0.2, "decline": -0.2, "gain": 0.2,
    "drop": -0.2, "rise": 0.2, "fall": -0.2, "climb": 0.2,
}


@dataclass
class SentimentResult:
    text: str
    label: str  # "positive" | "negative" | "neutral"
    score: float  # confidence 0-1
    normalized_score: float  # -1 to +1


class VaderSentimentAnalyzer:
    def __init__(self):
        self.analyzer = SentimentIntensityAnalyzer()

    @lru_cache(maxsize=200)
    def _analyze_text(self, text: str) -> SentimentResult:
        clean = text.strip()[:500]
        compound = self.analyzer.polarity_scores(clean)["compound"]

        if compound >= 0.05:
            label, confidence = "positive", abs(compound)
        elif compound <= -0.05:
            label, confidence = "negative", abs(compound)
        else:
            label, confidence = "neutral", 1.0 - abs(compound)

        adjustment = sum(boost for word, boost in FINANCIAL_BOOSTERS.items() if word in clean.lower())
        adjustment = max(-0.5, min(0.5, adjustment))
        adjusted = max(-1.0, min(1.0, compound + adjustment))

        return SentimentResult(text=clean, label=label, score=confidence, normalized_score=adjusted)

    async def analyze_news_articles(self, articles: List[NewsArticle]) -> List[SentimentResult]:
        return [self._analyze_text(f"{a.title}. {a.description}") for a in articles]

    async def get_symbol_sentiment_score(self, articles: List[NewsArticle]) -> Tuple[float, Dict]:
        if not articles:
            return 0.0, {"article_count": 0, "avg_confidence": 0.0}

        sentiments = await self.analyze_news_articles(articles)
        n = len(sentiments)

        # Newer articles (earlier in list) get slightly more weight.
        total_score = 0.0
        total_weight = 0.0
        for i, s in enumerate(sentiments):
            weight = s.score * (1.0 + 0.1 * (n - i) / n)
            total_score += s.normalized_score * weight
            total_weight += weight

        avg_sentiment = total_score / total_weight if total_weight > 0 else 0.0
        positive = sum(1 for s in sentiments if s.label == "positive")
        negative = sum(1 for s in sentiments if s.label == "negative")

        summary = {
            "article_count": n,
            "avg_confidence": sum(s.score for s in sentiments) / n,
            "positive_articles": positive,
            "negative_articles": negative,
            "neutral_articles": n - positive - negative,
            "sentiment_breakdown": [
                {"label": s.label, "score": s.normalized_score, "confidence": s.score}
                for s in sentiments
            ],
        }
        logger.info(f"Sentiment: {avg_sentiment:.3f} from {n} articles (+{positive}, -{negative}, ={n - positive - negative})")
        return avg_sentiment, summary


_instance: VaderSentimentAnalyzer = None


def get_vader_sentiment_analyzer() -> VaderSentimentAnalyzer:
    global _instance
    if _instance is None:
        _instance = VaderSentimentAnalyzer()
    return _instance
