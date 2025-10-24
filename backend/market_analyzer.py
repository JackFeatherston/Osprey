"""
Market Analyzer for analyzing market data and generating trade proposals.
Combines sentiment analysis with technical indicators.
Lightweight implementation optimized for EC2 free tier (1GB RAM).
"""

import asyncio
import json
import uuid
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable
from alpaca.data import StockHistoricalDataClient, StockBarsRequest, TimeFrame
from alpaca.trading import TradingClient, MarketOrderRequest, OrderSide, TimeInForce
import logging
import pytz

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TradingStrategy:
    """Base class for trading strategies"""
    
    def __init__(self, name: str):
        self.name = name
    
    async def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        """Analyze data and return trade signal if any"""
        raise NotImplementedError

# Legacy strategies removed - replaced with SentimentEnhancedStrategy

class MarketAnalyzer:
    """Main Market Analyzer for trade analysis and proposal generation"""
    
    def __init__(self, alpaca_api_key: str, alpaca_secret_key: str, supabase_client=None, websocket_manager=None):
        self.alpaca_api_key = alpaca_api_key
        self.alpaca_secret_key = alpaca_secret_key
        self.supabase_client = supabase_client
        self.websocket_manager = websocket_manager
        
        # List of user IDs to generate proposals for
        # In production, this could be fetched from user settings or all active users
        self.target_users = []  # Start empty, users get added via WebSocket auth
        
        # Initialize Alpaca clients
        self.data_client = StockHistoricalDataClient(alpaca_api_key, alpaca_secret_key)
        self.trading_client = TradingClient(alpaca_api_key, alpaca_secret_key, paper=True)  # Paper trading

        # Polling configuration (free tier compatible - no WebSocket bars)
        self.polling_interval_seconds = 120  # Poll every 2 minutes (configurable)
        logger.info("Using polling mode for market data (IEX free tier compatible)")

        # Initialize strategies
        from sentiment_trading_strategy import SentimentEnhancedStrategy
        self.strategies = [
            SentimentEnhancedStrategy()
        ]
        
        # Watchlist of symbols to monitor
        self.watchlist = ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"]
        
        self.is_running = False

    def is_market_hours(self) -> bool:
        """
        Check if current time is during market hours (9:30 AM - 4:00 PM ET, Mon-Fri).
        Returns True if market is open, False otherwise.
        """
        et_tz = pytz.timezone('America/New_York')
        now_et = datetime.now(et_tz)

        # Check if weekend
        if now_et.weekday() >= 5:  # Saturday=5, Sunday=6
            return False

        # Check if within market hours (9:30 AM - 4:00 PM ET)
        market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)

        return market_open <= now_et <= market_close

    async def start(self):
        """Start the market analyzer with polling mode (free tier compatible)"""
        self.is_running = True

        logger.info("Market analyzer starting in polling mode...")

        # Initial sentiment refresh on startup
        for strategy in self.strategies:
            if hasattr(strategy, 'refresh_daily_sentiment'):
                logger.info("Performing initial sentiment refresh...")
                await strategy.refresh_daily_sentiment(self.watchlist)

        # Create sentiment refresh task (checks every hour, refreshes if needed)
        async def sentiment_refresh_loop():
            while self.is_running:
                await asyncio.sleep(3600)  # Check every hour
                for strategy in self.strategies:
                    if hasattr(strategy, 'needs_sentiment_refresh') and strategy.needs_sentiment_refresh():
                        logger.info("Daily sentiment cache expired, refreshing...")
                        await strategy.refresh_daily_sentiment(self.watchlist)

        # Create polling loop for market data
        async def market_polling_loop():
            """Poll for latest market data every N seconds during market hours"""
            while self.is_running:
                try:
                    if self.is_market_hours():
                        logger.info(f"Market is open - polling watchlist symbols...")
                        # Analyze all watchlist symbols
                        for symbol in self.watchlist:
                            try:
                                await self.analyze_symbol(symbol)
                            except Exception as e:
                                logger.error(f"Error analyzing {symbol}: {str(e)}")
                    else:
                        et_tz = pytz.timezone('America/New_York')
                        now_et = datetime.now(et_tz)
                        logger.info(f"Market is closed (current time: {now_et.strftime('%I:%M %p ET')} on {now_et.strftime('%A')}). Waiting...")

                    # Wait before next poll
                    await asyncio.sleep(self.polling_interval_seconds)

                except Exception as e:
                    logger.error(f"Error in polling loop: {str(e)}")
                    await asyncio.sleep(60)  # Wait 1 minute on error before retry

        # Run both tasks concurrently
        sentiment_task = asyncio.create_task(sentiment_refresh_loop())
        polling_task = asyncio.create_task(market_polling_loop())

        logger.info(f"Market polling started (interval: {self.polling_interval_seconds}s, watchlist: {', '.join(self.watchlist)})")

        # Keep running until stopped
        await asyncio.gather(sentiment_task, polling_task, return_exceptions=True)
    
    def stop(self):
        """Stop the market analyzer polling loops"""
        self.is_running = False
        logger.info("Market analyzer stopped")
    
    async def analyze_markets(self):
        """Analyze market data for all watchlist symbols"""
        for symbol in self.watchlist:
            await self.analyze_symbol(symbol)
    
    async def fetch_intraday_bars(self, symbol: str, days: int = 7) -> Optional[pd.DataFrame]:
        """
        Fetch 1-minute intraday bars for a symbol.
        Returns last 7 days of 1-minute data (enough for technical analysis).
        Free tier: Uses real-time IEX data (1-minute bars).
        """
        end_date = datetime.now() - timedelta(minutes=15)
        start_date = end_date - timedelta(days=days)

        request_params = StockBarsRequest(
            symbol_or_symbols=[symbol],
            timeframe=TimeFrame.Minute,
            start=start_date,
            end=end_date
        )

        bars = self.data_client.get_stock_bars(request_params)

        if bars.df.empty:
            logger.warning(f"No 1-minute bars available for {symbol}")
            return None

        df = bars.df.reset_index()
        df = df[df['symbol'] == symbol].copy()

        logger.info(f"Fetched {len(df)} 1-minute bars for {symbol}")
        return df

    async def analyze_symbol(self, symbol: str):
        """Analyze a specific symbol using intraday 1-minute bars"""
        logger.info(f"Analyzing symbol {symbol} with intraday data...")

        # Fetch 1-minute intraday bars
        intraday_data = await self.fetch_intraday_bars(symbol)

        if intraday_data is None or len(intraday_data) < 20:
            logger.warning(f"Insufficient intraday data for {symbol}, skipping")
            return

        # Run strategy analysis on intraday data
        for strategy in self.strategies:
            signal = await strategy.analyze(intraday_data, symbol)
            if signal:
                logger.info(f"Generated trade signal for {symbol}: {signal}")
                await self.generate_proposal(symbol, signal, strategy.name)
            else:
                logger.info(f"No signal generated by {strategy.name} for {symbol}")
    
    async def generate_proposal(self, symbol: str, signal: Dict, strategy_name: str):
        """Generate and store trade proposals for all target users"""
        for user_id in self.target_users:
            proposal_data = {
                "id": str(uuid.uuid4()),
                "symbol": symbol,
                "action": signal["action"],
                "quantity": signal["quantity"],
                "price": signal["price"],
                "reason": f"[{strategy_name}] {signal['reason']}",
                "strategy": strategy_name,
                "user_id": user_id,
                "status": "PENDING"
            }
            
            await self._store_proposal(proposal_data)
    
    
    async def _store_proposal(self, proposal_data: Dict):
        """Store a single proposal in database and broadcast via WebSocket"""
        if not self.supabase_client:
            raise RuntimeError("Supabase client is required to store proposals")

        created_proposal = await self.supabase_client.create_trade_proposal(proposal_data)

        # Broadcast to WebSocket clients directly
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                'type': 'trade_proposals',
                'data': created_proposal
            })
    
    def add_target_user(self, user_id: str):
        """Add a user to receive trade proposals"""
        if user_id not in self.target_users:
            self.target_users.append(user_id)
    
    def remove_target_user(self, user_id: str):
        """Remove a user from receiving trade proposals"""
        if user_id in self.target_users:
            self.target_users.remove(user_id)
    
    def get_target_users(self) -> List[str]:
        """Get list of users receiving trade proposals"""
        return self.target_users.copy()
    
    def execute_trade(self, proposal: Dict) -> bool:
        """Execute an approved trade"""
        logger.info(f"=== EXECUTING TRADE ===")
        logger.info(f"Symbol: {proposal['symbol']}, Action: {proposal['action']}, Qty: {proposal['quantity']}, Price: ${proposal['price']}")

        order_side = OrderSide.BUY if proposal["action"] == "BUY" else OrderSide.SELL

        market_order_data = MarketOrderRequest(
            symbol=proposal["symbol"],
            qty=proposal["quantity"],
            side=order_side,
            time_in_force=TimeInForce.DAY
        )

        logger.info(f"Submitting order to Alpaca: {order_side.value} {proposal['quantity']} shares of {proposal['symbol']}")

        try:
            order = self.trading_client.submit_order(order_data=market_order_data)
            logger.info(f"Alpaca order submitted successfully! Order ID: {order.id}, Status: {order.status}")
            logger.info(f"=== TRADE EXECUTION COMPLETE ===")
            return True
        except Exception as e:
            logger.error(f"Failed to submit order to Alpaca: {str(e)}", exc_info=True)
            raise

# Singleton instance for the market analyzer
market_analyzer_instance: Optional[MarketAnalyzer] = None

def get_ai_engine() -> Optional[MarketAnalyzer]:
    """Get the market analyzer instance (kept as get_ai_engine for backward compatibility)"""
    return market_analyzer_instance

def initialize_ai_engine(alpaca_api_key: str, alpaca_secret_key: str, supabase_client=None, websocket_manager=None):
    """Initialize the market analyzer singleton (kept as initialize_ai_engine for backward compatibility)"""
    global market_analyzer_instance
    market_analyzer_instance = MarketAnalyzer(alpaca_api_key, alpaca_secret_key, supabase_client, websocket_manager)
    return market_analyzer_instance