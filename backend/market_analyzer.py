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
from alpaca.data.live import StockDataStream
from alpaca.trading import TradingClient, MarketOrderRequest, OrderSide, TimeInForce
import logging

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

        # Initialize WebSocket stream for real-time delayed bars (15-min delayed SIP feed)
        self.stream_client = StockDataStream(alpaca_api_key, alpaca_secret_key)

        # Initialize strategies
        from sentiment_trading_strategy import SentimentEnhancedStrategy
        self.strategies = [
            SentimentEnhancedStrategy()
        ]
        
        # Watchlist of symbols to monitor
        self.watchlist = ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"]
        
        self.is_running = False

    async def handle_bar_update(self, bar):
        """
        Handle incoming bar updates from WebSocket stream.
        When a new 15-minute bar arrives, analyze the symbol.
        """
        symbol = bar.symbol
        logger.info(f"Received bar update for {symbol} at {bar.timestamp}: close=${bar.close}")

        # Fetch historical intraday data for analysis
        # We need historical context, not just the single bar from WebSocket
        intraday_data = await self.fetch_intraday_bars(symbol)

        if intraday_data is None or len(intraday_data) < 20:
            logger.warning(f"Insufficient historical data for {symbol} after bar update")
            return

        # Run strategy analysis on the updated data
        for strategy in self.strategies:
            signal = await strategy.analyze(intraday_data, symbol)
            if signal:
                logger.info(f"Generated trade signal for {symbol} from bar update: {signal}")
                await self.generate_proposal(symbol, signal, strategy.name)

    async def start(self):
        """Start the market analyzer with WebSocket streaming"""
        self.is_running = True

        logger.info("Market analyzer starting...")

        # Initial sentiment refresh on startup
        for strategy in self.strategies:
            if hasattr(strategy, 'refresh_daily_sentiment'):
                logger.info("Performing initial sentiment refresh...")
                await strategy.refresh_daily_sentiment(self.watchlist)

        # Subscribe to 15-minute bars for all watchlist symbols
        logger.info(f"Subscribing to 15-minute bars for: {', '.join(self.watchlist)}")
        self.stream_client.subscribe_bars(self.handle_bar_update, *self.watchlist)

        # Create sentiment refresh task (checks every hour, refreshes if needed)
        async def sentiment_refresh_loop():
            while self.is_running:
                await asyncio.sleep(3600)  # Check every hour
                for strategy in self.strategies:
                    if hasattr(strategy, 'needs_sentiment_refresh') and strategy.needs_sentiment_refresh():
                        logger.info("Daily sentiment cache expired, refreshing...")
                        await strategy.refresh_daily_sentiment(self.watchlist)

        # Run WebSocket stream and sentiment refresh concurrently
        sentiment_task = asyncio.create_task(sentiment_refresh_loop())

        logger.info("Starting WebSocket stream (event-driven bar updates)...")
        await self.stream_client.run()  # This runs until stopped
    
    def stop(self):
        """Stop the market analyzer and WebSocket stream"""
        self.is_running = False
        self.stream_client.stop()
    
    async def analyze_markets(self):
        """Analyze market data for all watchlist symbols"""
        for symbol in self.watchlist:
            await self.analyze_symbol(symbol)
    
    async def fetch_intraday_bars(self, symbol: str, days: int = 7) -> Optional[pd.DataFrame]:
        """
        Fetch 15-minute intraday bars for a symbol.
        Returns last 7 days of 15-minute data (enough for technical analysis).
        Free tier: Uses 15-minute delayed SIP data (most recent data available).
        """
        end_date = datetime.now() - timedelta(minutes=15)
        start_date = end_date - timedelta(days=days)

        request_params = StockBarsRequest(
            symbol_or_symbols=[symbol],
            timeframe=TimeFrame.Minute15,
            start=start_date,
            end=end_date
        )

        bars = self.data_client.get_stock_bars(request_params)

        if bars.df.empty:
            logger.warning(f"No 15-minute bars available for {symbol}")
            return None

        df = bars.df.reset_index()
        df = df[df['symbol'] == symbol].copy()

        logger.info(f"Fetched {len(df)} 15-minute bars for {symbol}")
        return df

    async def analyze_symbol(self, symbol: str):
        """Analyze a specific symbol using intraday 15-minute bars"""
        logger.info(f"Analyzing symbol {symbol} with intraday data...")

        # Fetch 15-minute intraday bars
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
    
    async def execute_trade(self, proposal: Dict) -> bool:
        """Execute an approved trade"""
        order_side = OrderSide.BUY if proposal["action"] == "BUY" else OrderSide.SELL

        market_order_data = MarketOrderRequest(
            symbol=proposal["symbol"],
            qty=proposal["quantity"],
            side=order_side,
            time_in_force=TimeInForce.DAY
        )
        
        order = self.trading_client.submit_order(order_data=market_order_data)
        
        execution_log = {
            "proposal_id": proposal["id"],
            "order_id": str(order.id),
            "symbol": proposal["symbol"],
            "action": proposal["action"],
            "quantity": proposal["quantity"],
            "status": "EXECUTED",
            "timestamp": datetime.now().isoformat()
        }
        
        # Broadcast execution log via WebSocket
        if self.websocket_manager:
            await self.websocket_manager.broadcast({
                'type': 'trade_logs',
                'data': execution_log
            })
        
        return True

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