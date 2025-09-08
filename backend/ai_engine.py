"""
AI Engine for analyzing market data and generating trade proposals.
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
from alpaca.trading import TradingClient, MarketOrderRequest, OrderSide
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TradingStrategy:
    """Base class for trading strategies"""
    
    def __init__(self, name: str):
        self.name = name
    
    def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        """Analyze data and return trade signal if any"""
        raise NotImplementedError

class MovingAverageCrossover(TradingStrategy):
    """Simple moving average crossover strategy"""
    
    def __init__(self, short_window: int = 20, long_window: int = 50):
        super().__init__("MA_Crossover")
        self.short_window = short_window
        self.long_window = long_window
    
    def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        if len(data) < self.long_window:
            return None
        
        # Calculate moving averages
        data['MA_short'] = data['close'].rolling(window=self.short_window).mean()
        data['MA_long'] = data['close'].rolling(window=self.long_window).mean()
        
        # Get latest values
        current_short = data['MA_short'].iloc[-1]
        current_long = data['MA_long'].iloc[-1]
        prev_short = data['MA_short'].iloc[-2]
        prev_long = data['MA_long'].iloc[-2]
        current_price = data['close'].iloc[-1]
        
        # Check for crossover
        if prev_short <= prev_long and current_short > current_long:
            # Bullish crossover
            return {
                "action": "BUY",
                "price": float(current_price),
                "quantity": 10, 
                "reason": f"Bullish MA crossover: {self.short_window}-day MA (${current_short:.2f}) crossed above {self.long_window}-day MA (${current_long:.2f})"
            }
        elif prev_short >= prev_long and current_short < current_long:
            # Bearish crossover
            return {
                "action": "SELL",
                "price": float(current_price),
                "quantity": 10,
                "reason": f"Bearish MA crossover: {self.short_window}-day MA (${current_short:.2f}) crossed below {self.long_window}-day MA (${current_long:.2f})"
            }
        
        return None

class RSIStrategy(TradingStrategy):
    """RSI-based strategy"""
    
    def __init__(self, period: int = 14, oversold: float = 30, overbought: float = 70):
        super().__init__("RSI")
        self.period = period
        self.oversold = oversold
        self.overbought = overbought
    
    def calculate_rsi(self, prices: pd.Series) -> pd.Series:
        """Calculate RSI"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=self.period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=self.period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    def analyze(self, data: pd.DataFrame, symbol: str) -> Optional[Dict]:
        if len(data) < self.period + 1:
            return None
        
        # Calculate RSI
        data['RSI'] = self.calculate_rsi(data['close'])
        current_rsi = data['RSI'].iloc[-1]
        current_price = data['close'].iloc[-1]
        
        if current_rsi < self.oversold:
            return {
                "action": "BUY",
                "price": float(current_price),
                "quantity": 10,
                "reason": f"RSI oversold signal: RSI={current_rsi:.2f} below {self.oversold}"
            }
        elif current_rsi > self.overbought:
            return {
                "action": "SELL",
                "price": float(current_price),
                "quantity": 10,
                "reason": f"RSI overbought signal: RSI={current_rsi:.2f} above {self.overbought}"
            }
        
        return None

class AIEngine:
    """Main AI Engine for trade analysis and proposal generation"""
    
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
        
        # Initialize strategies
        self.strategies = [
            MovingAverageCrossover(short_window=20, long_window=50),
            RSIStrategy(period=14)
        ]
        
        # Watchlist of symbols to monitor
        self.watchlist = ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"]
        
        self.is_running = False
        
    async def start(self):
        """Start the AI engine"""
        self.is_running = True
        
        while self.is_running:
            await self.analyze_markets()
            await asyncio.sleep(60)
    
    def stop(self):
        """Stop the AI engine"""
        self.is_running = False
    
    async def analyze_markets(self):
        """Analyze market data for all watchlist symbols"""
        for symbol in self.watchlist:
            await self.analyze_symbol(symbol)
    
    async def analyze_symbol(self, symbol: str):
        """Analyze a specific symbol and generate proposals if needed"""
        try:
            logger.info(f"Analyzing symbol {symbol}...")
            # Use delayed data - end date is 1 day ago to avoid SIP data restrictions
            end_date = datetime.now() - timedelta(days=1)
            start_date = end_date - timedelta(days=100)
            
            # Try different data sources in order of preference
            success = False
            
            # First, try with delayed daily data
            try:
                request_params = StockBarsRequest(
                    symbol_or_symbols=[symbol],
                    timeframe=TimeFrame.Day,
                    start=start_date,
                    end=end_date
                )
                
                bars = self.data_client.get_stock_bars(request_params)
                logger.info(f"Retrieved {len(bars.df) if not bars.df.empty else 0} daily bars for {symbol}")
                
                if not bars.df.empty:
                    df = bars.df.reset_index()
                    df = df[df['symbol'] == symbol].copy()
                    logger.info(f"Processed {len(df)} daily bars for {symbol}")
                    
                    if len(df) > 0:
                        success = True
                        for strategy in self.strategies:
                            signal = strategy.analyze(df, symbol)
                            if signal:
                                logger.info(f"Generated real trade signal for {symbol}: {signal}")
                                await self.generate_proposal(symbol, signal, strategy.name)
                            else:
                                logger.info(f"No signal generated by {strategy.name} for {symbol}")
                    else:
                        logger.warning(f"No data found for {symbol} after filtering")
                else:
                    logger.warning(f"No daily bars returned for {symbol}")
            except Exception as daily_error:
                logger.warning(f"Daily data failed for {symbol}: {daily_error}")
            
            # If daily data fails, try hourly data with shorter timeframe
            if not success:
                try:
                    logger.info(f"Trying hourly data for {symbol}...")
                    short_end_date = datetime.now() - timedelta(days=2)  # Go back further
                    short_start_date = short_end_date - timedelta(days=30)  # Shorter period
                    
                    request_params = StockBarsRequest(
                        symbol_or_symbols=[symbol],
                        timeframe=TimeFrame.Hour,
                        start=short_start_date,
                        end=short_end_date
                    )
                    
                    bars = self.data_client.get_stock_bars(request_params)
                    logger.info(f"Retrieved {len(bars.df) if not bars.df.empty else 0} hourly bars for {symbol}")
                    
                    if not bars.df.empty:
                        df = bars.df.reset_index()
                        df = df[df['symbol'] == symbol].copy()
                        
                        # Convert hourly to daily by resampling
                        if len(df) > 0:
                            df['timestamp'] = pd.to_datetime(df['timestamp'])
                            df = df.set_index('timestamp')
                            daily_df = df.resample('D').agg({
                                'open': 'first',
                                'high': 'max',
                                'low': 'min',
                                'close': 'last',
                                'volume': 'sum'
                            }).dropna()
                            daily_df = daily_df.reset_index()
                            
                            logger.info(f"Converted {len(df)} hourly bars to {len(daily_df)} daily bars for {symbol}")
                            
                            if len(daily_df) > 10:  # Need sufficient data for analysis
                                success = True
                                for strategy in self.strategies:
                                    signal = strategy.analyze(daily_df, symbol)
                                    if signal:
                                        logger.info(f"Generated real trade signal for {symbol} using hourly->daily data: {signal}")
                                        await self.generate_proposal(symbol, signal, strategy.name)
                                    else:
                                        logger.info(f"No signal generated by {strategy.name} for {symbol}")
                except Exception as hourly_error:
                    logger.warning(f"Hourly data failed for {symbol}: {hourly_error}")
            
            # Log if all data sources fail
            if not success:
                logger.warning(f"All data sources failed for {symbol}, skipping symbol")
                
        except Exception as e:
            logger.error(f"Error analyzing symbol {symbol}: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            # Log and continue on uncaught errors
            logger.info(f"Unexpected error for {symbol}. Skipping symbol...")
    
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
        if self.supabase_client:
            created_proposal = await self.supabase_client.create_trade_proposal(proposal_data)
            # Broadcast to WebSocket clients directly
            if self.websocket_manager:
                await self.websocket_manager.broadcast({
                    'type': 'trade_proposals',
                    'data': created_proposal
                })
        else:
            # Fallback: broadcast proposal data directly if no database
            if self.websocket_manager:
                await self.websocket_manager.broadcast({
                    'type': 'trade_proposals',
                    'data': proposal_data
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
            side=order_side
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

# Singleton instance for the AI engine
ai_engine_instance: Optional[AIEngine] = None

def get_ai_engine() -> Optional[AIEngine]:
    """Get the AI engine instance"""
    return ai_engine_instance

def initialize_ai_engine(alpaca_api_key: str, alpaca_secret_key: str, supabase_client=None, websocket_manager=None):
    """Initialize the AI engine singleton"""
    global ai_engine_instance
    ai_engine_instance = AIEngine(alpaca_api_key, alpaca_secret_key, supabase_client, websocket_manager)
    return ai_engine_instance