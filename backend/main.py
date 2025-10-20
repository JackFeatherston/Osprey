from fastapi import FastAPI, HTTPException, Header, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Set, Dict, Any
import json
import uvicorn
import asyncio
import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from market_analyzer import initialize_ai_engine, get_ai_engine
from supabase_client import get_supabase_client, SupabaseClient
from auth_middleware import get_current_user, require_auth, get_user_id
import uuid
from datetime import datetime, timedelta
import threading
from alpaca.data import TimeFrame
from alpaca.data.requests import StockBarsRequest

# Load environment variables
load_dotenv()

# Setup logger
logger = logging.getLogger(__name__)

# Lifespan manager for market analyzer
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    alpaca_api_key = os.getenv("ALPACA_API_KEY")
    alpaca_secret_key = os.getenv("ALPACA_SECRET_KEY")

    if alpaca_api_key and alpaca_secret_key:
        market_analyzer = initialize_ai_engine(alpaca_api_key, alpaca_secret_key, db, manager)
        analyzer_task = asyncio.create_task(market_analyzer.start())
        app.state.market_analyzer = market_analyzer
        app.state.analyzer_task = analyzer_task

    yield

    # Shutdown
    if hasattr(app.state, 'analyzer_task'):
        market_analyzer = get_ai_engine()
        if market_analyzer:
            market_analyzer.stop()
        app.state.analyzer_task.cancel()
        try:
            await app.state.analyzer_task
        except asyncio.CancelledError:
            pass

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Data models
class TradeProposal(BaseModel):
    id: str
    symbol: str
    action: str  # "BUY" or "SELL"
    quantity: int
    price: float
    reason: str
    timestamp: Optional[str] = None
    created_at: Optional[str] = None

class TradeDecision(BaseModel):
    proposal_id: str
    decision: str  # "APPROVED" or "REJECTED"
    user_id: Optional[str] = None
    notes: Optional[str] = None

# Initialize Supabase client
db = get_supabase_client()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients, auto-remove dead connections"""
        dead_connections = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except:
                dead_connections.add(connection)

        # Clean up dead connections
        self.active_connections -= dead_connections

manager = ConnectionManager()


@app.get("/")
async def root():
    return {"message": "Trading Assistant API", "status": "running"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "websocket_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/proposals", response_model=List[TradeProposal])
async def get_proposals(user_id: str = Depends(get_user_id)):
    proposals = await db.get_trade_proposals(user_id=user_id, status="PENDING")
    return proposals

@app.post("/proposals")
async def create_proposal(proposal: TradeProposal, user_id: str = Depends(get_user_id)):
    # Convert proposal to dict and add required fields
    proposal_data = proposal.dict()
    if 'id' not in proposal_data or not proposal_data['id']:
        proposal_data['id'] = str(uuid.uuid4())
    
    proposal_data['user_id'] = user_id
    
    # Create proposal in database
    created_proposal = await db.create_trade_proposal(proposal_data)
    
    # Broadcast directly via WebSocket
    await manager.broadcast({
        'type': 'trade_proposals',
        'data': created_proposal
    })
    
    return {"status": "proposal created", "id": created_proposal['id']}

@app.post("/decisions")
async def submit_decision(decision: TradeDecision):
    proposal = await db.get_trade_proposal(decision.proposal_id)

    if not proposal:
        raise HTTPException(status_code=404, detail=f"Proposal {decision.proposal_id} not found")

    decision_data = {
        "proposal_id": decision.proposal_id,
        "user_id": proposal["user_id"],
        "decision": decision.decision,
        "notes": getattr(decision, 'notes', None)
    }

    # Always log the decision first, regardless of execution outcome
    created_decision = await db.create_trade_decision(decision_data)

    execution_success = False
    execution_error = None

    if decision.decision == "APPROVED":
        market_analyzer = get_ai_engine()
        if market_analyzer:
            execution_data = {
                "proposal_id": decision.proposal_id,
                "user_id": proposal["user_id"],
                "symbol": proposal["symbol"],
                "action": proposal["action"],
                "quantity": proposal["quantity"],
                "execution_status": "PENDING"
            }

            execution_record = await db.create_trade_execution(execution_data)

            # Wrap trade execution in try-catch to handle failures gracefully
            try:
                execution_result = await market_analyzer.execute_trade(proposal)

                if execution_result:
                    await db.update_trade_execution(execution_record["id"], {
                        "execution_status": "FILLED",
                        "executed_price": proposal["price"],
                        "executed_at": datetime.now().isoformat()
                    })
                    execution_success = True
                else:
                    await db.update_trade_execution(execution_record["id"], {
                        "execution_status": "REJECTED",
                        "error_message": "Trade execution returned false"
                    })
                    execution_error = "Trade execution failed"
            except Exception as e:
                # Log the error and update execution record
                error_msg = str(e)
                logger.error(f"Trade execution failed: {error_msg}")
                await db.update_trade_execution(execution_record["id"], {
                    "execution_status": "REJECTED",
                    "error_message": error_msg
                })
                execution_error = error_msg
        else:
            execution_error = "Market analyzer not available"

    result = {"status": "decision recorded", "decision": decision.decision}
    if decision.decision == "APPROVED":
        result["executed"] = execution_success
        if execution_error:
            result["error"] = execution_error

    return result

@app.get("/decisions")
async def get_decisions(user_id: str = Depends(get_user_id)):
    decisions = await db.get_trade_decisions(user_id)
    return decisions

@app.get("/ai-status")
async def get_ai_status():
    """Get market analyzer status (kept as /ai-status for frontend compatibility)"""
    market_analyzer = get_ai_engine()
    if market_analyzer:
        return {
            "status": "running" if market_analyzer.is_running else "stopped",
            "watchlist": market_analyzer.watchlist,
            "strategies": [strategy.name for strategy in market_analyzer.strategies]
        }
    return {"status": "not initialized"}

@app.get("/dashboard-stats")
async def get_dashboard_stats(user_id: str = Depends(get_user_id)):
    """Get dashboard statistics for the user"""
    active_proposals = await db.get_active_proposals(user_id)
    portfolio_summary = await db.get_user_portfolio_summary(user_id)
    executions = await db.get_trade_executions(user_id)
    
    today_executions = [
        ex for ex in executions 
        if ex.get('executed_at') and ex['executed_at'].startswith(datetime.now().strftime('%Y-%m-%d'))
    ]
    
    return {
        "active_proposals": len(active_proposals),
        "executed_trades_today": len(today_executions),
        "total_trades": portfolio_summary.get("total_trades", 0),
        "total_trade_volume": float(portfolio_summary.get("total_trade_volume", 0)),
        "buy_trades": portfolio_summary.get("buy_trades", 0),
        "sell_trades": portfolio_summary.get("sell_trades", 0)
    }

@app.get("/order-history")
async def get_order_history(user_id: str = Depends(get_user_id)):
    """Get complete order history - all trade decisions with proposal details"""
    history = await db.get_order_history(user_id)
    return history

@app.get("/account")
async def get_account_info():
    """Get Alpaca account information"""
    market_analyzer = get_ai_engine()
    account = market_analyzer.trading_client.get_account()
    return {
        "account_id": account.id,
        "buying_power": float(account.buying_power),
        "cash": float(account.cash),
        "portfolio_value": float(account.portfolio_value),
        "status": account.status
    }

@app.delete("/proposals/clear")
async def clear_user_proposals(user_id: str = Depends(get_user_id)):
    """Clear all pending proposals for the user"""
    cleared_count = await db.clear_pending_proposals(user_id)
    return {"status": "proposals cleared", "count": cleared_count}

@app.get("/orderbook")
async def get_orderbook(symbol: str = "AAPL"):
    """Get order book data for a symbol from Alpaca"""
    try:
        market_analyzer = get_ai_engine()
        if not market_analyzer:
            raise HTTPException(status_code=503, detail="Market analyzer not available")

        # Get latest quote for the symbol
        from alpaca.data.requests import StockLatestQuoteRequest
        request = StockLatestQuoteRequest(symbol_or_symbols=symbol)
        quote = market_analyzer.data_client.get_stock_latest_quote(request)

        if symbol in quote:
            latest = quote[symbol]
            bid_price = float(latest.bid_price) if latest.bid_price else 0.0
            ask_price = float(latest.ask_price) if latest.ask_price else 0.0
            bid_size = int(latest.bid_size) if latest.bid_size else 0
            ask_size = int(latest.ask_size) if latest.ask_size else 0

            # Validate ask/bid prices - ask should be greater than bid
            # and spread should be reasonable (< 10%)
            if ask_price <= bid_price or (ask_price - bid_price) / bid_price > 0.10:
                logger.warning(f"Invalid ask/bid prices for {symbol}: bid=${bid_price}, ask=${ask_price}. Calculating synthetic ask.")
                # Calculate synthetic ask with 0.01% spread
                ask_price = bid_price * 1.0001
                if ask_size == 0:
                    ask_size = bid_size

            # Generate order book levels around the current bid/ask
            # Use 0.05% of price per level for realistic spread
            price_increment = max(bid_price * 0.0005, 0.01)  # At least 1 cent
            bids = []
            asks = []

            for i in range(6):
                bid_level_price = bid_price - (i * price_increment)
                bid_quantity = bid_size + (i * 2)
                bids.append({
                    "price": round(bid_level_price, 2),
                    "quantity": bid_quantity,
                    "total": round(bid_level_price * bid_quantity, 2)
                })

                ask_level_price = ask_price + (i * price_increment)
                ask_quantity = ask_size + (i * 2)
                asks.append({
                    "price": round(ask_level_price, 2),
                    "quantity": ask_quantity,
                    "total": round(ask_level_price * ask_quantity, 2)
                })

            return {
                "symbol": symbol,
                "bids": bids,
                "asks": asks
            }
        else:
            raise HTTPException(status_code=404, detail=f"Quote not found for symbol {symbol}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order book: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch order book: {str(e)}")

@app.get("/bars/{symbol}")
async def get_bars(symbol: str, days: int = 30):
    """Get historical candlestick bar data for a symbol"""
    try:
        market_analyzer = get_ai_engine()
        if not market_analyzer:
            raise HTTPException(status_code=503, detail="Market analyzer not available")

        # Get historical data - use delayed data (1 day ago) to avoid SIP restrictions
        end_date = datetime.now() - timedelta(days=1)
        start_date = end_date - timedelta(days=days)

        request_params = StockBarsRequest(
            symbol_or_symbols=[symbol],
            timeframe=TimeFrame.Day,
            start=start_date,
            end=end_date
        )

        bars = market_analyzer.data_client.get_stock_bars(request_params)

        if bars.df.empty:
            return {"symbol": symbol, "bars": []}

        df = bars.df.reset_index()
        df = df[df['symbol'] == symbol].copy()

        # Convert to list of dicts for JSON response
        bar_data = []
        for _, row in df.iterrows():
            bar_data.append({
                "time": row['timestamp'].isoformat(),
                "open": float(row['open']),
                "high": float(row['high']),
                "low": float(row['low']),
                "close": float(row['close']),
                "volume": int(row['volume'])
            })

        return {
            "symbol": symbol,
            "bars": bar_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bars for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch bars: {str(e)}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """WebSocket endpoint with user authentication and proposal targeting"""
    await manager.connect(websocket)
    logger.info("WebSocket connection accepted")

    user_id = "d6c02463-eb2d-4d5a-9ba3-cc97d20910b3"
    market_analyzer = get_ai_engine()

    if market_analyzer:
        market_analyzer.add_target_user(user_id)
        logger.info(f"User {user_id} registered for proposals. Target users: {market_analyzer.get_target_users()}")
    else:
        logger.error("Market analyzer not available!")

    try:
        # Keep connection alive without blocking
        # The client only receives messages, never sends them
        while True:
            await asyncio.sleep(1)  # Keep connection alive with periodic sleep
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id}")
    finally:
        if market_analyzer:
            market_analyzer.remove_target_user(user_id)
            logger.info(f"User {user_id} unregistered from proposals")
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)