"""
Market analyzer: polls Alpaca for intraday bars during market hours,
runs trading strategies, and emits proposals to connected users.
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import pandas as pd
import pytz
from alpaca.data import StockBarsRequest, StockHistoricalDataClient, TimeFrame
from alpaca.trading import MarketOrderRequest, OrderSide, TimeInForce, TradingClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ET = pytz.timezone("America/New_York")
WATCHLIST = ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"]
POLL_INTERVAL_SECONDS = 120
SENTIMENT_CHECK_INTERVAL_SECONDS = 3600


class TradingStrategy:
    def __init__(self, name: str):
        self.name = name

    async def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        raise NotImplementedError


class MarketAnalyzer:
    def __init__(self, alpaca_api_key: str, alpaca_secret_key: str, supabase_client=None, websocket_manager=None):
        self.supabase_client = supabase_client
        self.websocket_manager = websocket_manager
        self.target_users: List[str] = []

        self.data_client = StockHistoricalDataClient(alpaca_api_key, alpaca_secret_key)
        self.trading_client = TradingClient(alpaca_api_key, alpaca_secret_key, paper=True)

        from sentiment_trading_strategy import SentimentEnhancedStrategy
        self.strategies = [SentimentEnhancedStrategy()]
        self.watchlist = WATCHLIST

        self.position_size_percent = float(os.getenv("POSITION_SIZE_PERCENT", "0.02"))
        self.max_position_percent = float(os.getenv("MAX_POSITION_PERCENT", "0.10"))
        self.min_portfolio_value = 100.0

        self.is_running = False

    def is_market_hours(self) -> bool:
        now = datetime.now(ET)
        if now.weekday() >= 5:
            return False
        open_ = now.replace(hour=9, minute=30, second=0, microsecond=0)
        close = now.replace(hour=16, minute=0, second=0, microsecond=0)
        return open_ <= now <= close

    def calculate_position_size(self, symbol: str, current_price: float) -> int:
        account = self.trading_client.get_account()
        portfolio_value = float(account.portfolio_value)
        buying_power = float(account.buying_power)

        if portfolio_value < self.min_portfolio_value:
            logger.warning(f"Portfolio value ${portfolio_value:.2f} below minimum, skipping trade")
            return 0

        target_value = min(
            portfolio_value * self.position_size_percent,
            portfolio_value * self.max_position_percent,
        )
        shares = int(target_value / current_price)

        if shares * current_price > buying_power:
            shares = int(buying_power / current_price)

        logger.info(f"Position size for {symbol}: {shares} shares @ ${current_price:.2f}")
        return shares

    async def start(self):
        self.is_running = True
        logger.info("Market analyzer starting...")

        for strategy in self.strategies:
            if hasattr(strategy, "refresh_daily_sentiment"):
                await strategy.refresh_daily_sentiment(self.watchlist)

        await asyncio.gather(
            self._sentiment_refresh_loop(),
            self._market_polling_loop(),
            return_exceptions=True,
        )

    def stop(self):
        self.is_running = False
        logger.info("Market analyzer stopped")

    async def _sentiment_refresh_loop(self):
        while self.is_running:
            await asyncio.sleep(SENTIMENT_CHECK_INTERVAL_SECONDS)
            for strategy in self.strategies:
                if hasattr(strategy, "needs_sentiment_refresh") and strategy.needs_sentiment_refresh():
                    logger.info("Daily sentiment cache expired, refreshing...")
                    await strategy.refresh_daily_sentiment(self.watchlist)

    async def _market_polling_loop(self):
        while self.is_running:
            try:
                if self.is_market_hours():
                    for symbol in self.watchlist:
                        try:
                            await self.analyze_symbol(symbol)
                        except Exception as e:
                            logger.error(f"Error analyzing {symbol}: {e}")
                else:
                    now = datetime.now(ET)
                    logger.info(f"Market closed ({now.strftime('%I:%M %p ET, %A')}). Waiting...")
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
            except Exception as e:
                logger.error(f"Polling loop error: {e}")
                await asyncio.sleep(60)

    async def fetch_intraday_bars(self, symbol: str, days: int = 7) -> Optional[pd.DataFrame]:
        # 15-minute delay keeps us inside IEX free-tier limits.
        end_date = datetime.now() - timedelta(minutes=15)
        start_date = end_date - timedelta(days=days)

        bars = self.data_client.get_stock_bars(StockBarsRequest(
            symbol_or_symbols=[symbol],
            timeframe=TimeFrame.Minute,
            start=start_date,
            end=end_date,
        ))

        if bars.df.empty:
            return None

        df = bars.df.reset_index()
        return df[df["symbol"] == symbol].copy()

    async def analyze_symbol(self, symbol: str):
        data = await self.fetch_intraday_bars(symbol)
        if data is None or len(data) < 20:
            return

        for strategy in self.strategies:
            signal = await strategy.analyze(data, symbol)
            if signal:
                await self.generate_proposal(symbol, signal, strategy.name)

    async def generate_proposal(self, symbol: str, signal: Dict, strategy_name: str):
        quantity = self.calculate_position_size(symbol, signal["price"])
        if quantity == 0:
            return

        for user_id in self.target_users:
            proposal = {
                "id": str(uuid.uuid4()),
                "symbol": symbol,
                "action": signal["action"],
                "quantity": quantity,
                "price": signal["price"],
                "reason": f"[{strategy_name}] {signal['reason']}",
                "strategy": strategy_name,
                "user_id": user_id,
                "status": "PENDING",
                "timestamp": datetime.now().isoformat(),
            }
            created = await self.supabase_client.create_trade_proposal(proposal)
            if self.websocket_manager:
                await self.websocket_manager.broadcast({"type": "trade_proposals", "data": created})

    def add_target_user(self, user_id: str):
        if user_id not in self.target_users:
            self.target_users.append(user_id)

    def remove_target_user(self, user_id: str):
        if user_id in self.target_users:
            self.target_users.remove(user_id)

    def execute_trade(self, proposal: Dict) -> bool:
        order = MarketOrderRequest(
            symbol=proposal["symbol"],
            qty=proposal["quantity"],
            side=OrderSide.BUY if proposal["action"] == "BUY" else OrderSide.SELL,
            time_in_force=TimeInForce.DAY,
        )
        submitted = self.trading_client.submit_order(order_data=order)
        logger.info(f"Order submitted: {submitted.id} ({proposal['action']} {proposal['quantity']} {proposal['symbol']})")
        return True


_instance: Optional[MarketAnalyzer] = None


def get_market_analyzer() -> Optional[MarketAnalyzer]:
    return _instance


def initialize_market_analyzer(alpaca_api_key: str, alpaca_secret_key: str, supabase_client=None, websocket_manager=None):
    global _instance
    _instance = MarketAnalyzer(alpaca_api_key, alpaca_secret_key, supabase_client, websocket_manager)
    return _instance
