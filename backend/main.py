import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional, Set

import uvicorn
from alpaca.data import TimeFrame
from alpaca.data.requests import StockBarsRequest, StockLatestQuoteRequest
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from auth_middleware import get_user_id, verify_jwt_token
from market_analyzer import get_market_analyzer, initialize_market_analyzer
from supabase_client import get_supabase_client

load_dotenv()
logger = logging.getLogger(__name__)


class TradeProposal(BaseModel):
    id: str
    symbol: str
    action: str
    quantity: int
    price: float
    reason: str
    timestamp: Optional[str] = None
    created_at: Optional[str] = None


class TradeDecision(BaseModel):
    proposal_id: str
    decision: str
    user_id: Optional[str] = None
    notes: Optional[str] = None


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead = set()
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                dead.add(connection)
        self.active_connections -= dead


db = get_supabase_client()
manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    alpaca_key = os.getenv("ALPACA_API_KEY")
    alpaca_secret = os.getenv("ALPACA_SECRET_KEY")

    if alpaca_key and alpaca_secret:
        analyzer = initialize_market_analyzer(alpaca_key, alpaca_secret, db, manager)
        app.state.analyzer_task = asyncio.create_task(analyzer.start())

    yield

    analyzer = get_market_analyzer()
    if analyzer:
        analyzer.stop()
    if hasattr(app.state, "analyzer_task"):
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


@app.get("/")
async def root():
    return {"message": "Trading Assistant API", "status": "running"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "websocket_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/proposals", response_model=List[TradeProposal])
async def get_proposals(user_id: str = Depends(get_user_id)):
    return await db.get_trade_proposals(user_id=user_id, status="PENDING")


@app.post("/proposals")
async def create_proposal(proposal: TradeProposal, user_id: str = Depends(get_user_id)):
    data = proposal.dict()
    data["id"] = data.get("id") or str(uuid.uuid4())
    data["user_id"] = user_id

    created = await db.create_trade_proposal(data)
    await manager.broadcast({"type": "trade_proposals", "data": created})
    return {"status": "proposal created", "id": created["id"]}


@app.post("/decisions")
async def submit_decision(decision: TradeDecision):
    proposal = await db.get_trade_proposal(decision.proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail=f"Proposal {decision.proposal_id} not found")

    await db.create_trade_decision({
        "proposal_id": decision.proposal_id,
        "user_id": proposal["user_id"],
        "decision": decision.decision,
        "notes": decision.notes,
    })

    if decision.decision != "APPROVED":
        return {"status": "decision recorded", "decision": decision.decision}

    analyzer = get_market_analyzer()
    if not analyzer:
        return {"status": "decision recorded", "decision": decision.decision, "executed": False, "error": "Market analyzer not available"}

    execution = await db.create_trade_execution({
        "proposal_id": decision.proposal_id,
        "user_id": proposal["user_id"],
        "symbol": proposal["symbol"],
        "action": proposal["action"],
        "quantity": proposal["quantity"],
        "execution_status": "PENDING",
    })

    try:
        analyzer.execute_trade(proposal)
    except Exception as e:
        await db.update_trade_execution(execution["id"], {
            "execution_status": "REJECTED",
            "error_message": str(e),
        })
        return {"status": "decision recorded", "decision": decision.decision, "executed": False, "error": str(e)}

    await db.update_trade_execution(execution["id"], {
        "execution_status": "FILLED",
        "executed_price": proposal["price"],
        "executed_at": datetime.now().isoformat(),
    })
    await manager.broadcast({
        "type": "trade_logs",
        "data": {
            "proposal_id": proposal["id"],
            "symbol": proposal["symbol"],
            "action": proposal["action"],
            "quantity": proposal["quantity"],
            "status": "EXECUTED",
            "timestamp": datetime.now().isoformat(),
        },
    })
    return {"status": "decision recorded", "decision": decision.decision, "executed": True}


@app.get("/decisions")
async def get_decisions(user_id: str = Depends(get_user_id)):
    return await db.get_trade_decisions(user_id)


@app.get("/ai-status")
async def get_ai_status():
    analyzer = get_market_analyzer()
    if not analyzer:
        return {"status": "not initialized"}
    return {
        "status": "running" if analyzer.is_running else "stopped",
        "watchlist": analyzer.watchlist,
        "strategies": [s.name for s in analyzer.strategies],
    }


@app.get("/dashboard-stats")
async def get_dashboard_stats(user_id: str = Depends(get_user_id)):
    active = await db.get_active_proposals(user_id)
    summary = await db.get_user_portfolio_summary(user_id)
    executions = await db.get_trade_executions(user_id)

    today = datetime.now().strftime("%Y-%m-%d")
    today_executions = [e for e in executions if e.get("executed_at", "").startswith(today)]

    return {
        "active_proposals": len(active),
        "executed_trades_today": len(today_executions),
        "total_trades": summary.get("total_trades", 0),
        "total_trade_volume": float(summary.get("total_trade_volume", 0)),
        "buy_trades": summary.get("buy_trades", 0),
        "sell_trades": summary.get("sell_trades", 0),
    }


@app.get("/order-history")
async def get_order_history(user_id: str = Depends(get_user_id)):
    return await db.get_order_history(user_id)


@app.get("/account")
async def get_account_info():
    analyzer = get_market_analyzer()
    account = analyzer.trading_client.get_account()
    return {
        "account_id": account.id,
        "buying_power": float(account.buying_power),
        "cash": float(account.cash),
        "portfolio_value": float(account.portfolio_value),
        "status": account.status,
    }


@app.delete("/proposals/clear")
async def clear_user_proposals(user_id: str = Depends(get_user_id)):
    count = await db.clear_pending_proposals(user_id)
    return {"status": "proposals cleared", "count": count}


def _build_orderbook_levels(bid_price: float, ask_price: float, bid_size: int, ask_size: int, depth: int = 6):
    # Validate: ask must be greater than bid and spread under 10%; otherwise synthesize a tight ask.
    if ask_price <= bid_price or (ask_price - bid_price) / bid_price > 0.10:
        ask_price = bid_price * 1.0001
        if ask_size == 0:
            ask_size = bid_size

    increment = max(bid_price * 0.0005, 0.01)
    bids, asks = [], []
    for i in range(depth):
        bp = round(bid_price - i * increment, 2)
        bq = bid_size + i * 2
        bids.append({"price": bp, "quantity": bq, "total": round(bp * bq, 2)})

        ap = round(ask_price + i * increment, 2)
        aq = ask_size + i * 2
        asks.append({"price": ap, "quantity": aq, "total": round(ap * aq, 2)})
    return bids, asks


@app.get("/orderbook")
async def get_orderbook(symbol: str = "AAPL"):
    analyzer = get_market_analyzer()
    if not analyzer:
        raise HTTPException(status_code=503, detail="Market analyzer not available")

    quotes = analyzer.data_client.get_stock_latest_quote(StockLatestQuoteRequest(symbol_or_symbols=symbol))
    if symbol not in quotes:
        raise HTTPException(status_code=404, detail=f"Quote not found for symbol {symbol}")

    quote = quotes[symbol]
    bids, asks = _build_orderbook_levels(
        bid_price=float(quote.bid_price or 0),
        ask_price=float(quote.ask_price or 0),
        bid_size=int(quote.bid_size or 0),
        ask_size=int(quote.ask_size or 0),
    )
    return {"symbol": symbol, "bids": bids, "asks": asks}


@app.get("/bars/{symbol}")
async def get_bars(symbol: str, days: int = 30):
    analyzer = get_market_analyzer()
    if not analyzer:
        raise HTTPException(status_code=503, detail="Market analyzer not available")

    # Delayed data (1 day ago) avoids SIP restrictions on free tier.
    end_date = datetime.now() - timedelta(days=1)
    start_date = end_date - timedelta(days=days)

    bars = analyzer.data_client.get_stock_bars(StockBarsRequest(
        symbol_or_symbols=[symbol],
        timeframe=TimeFrame.Day,
        start=start_date,
        end=end_date,
    ))

    if bars.df.empty:
        return {"symbol": symbol, "bars": []}

    df = bars.df.reset_index()
    df = df[df["symbol"] == symbol]

    return {
        "symbol": symbol,
        "bars": [
            {
                "time": row["timestamp"].isoformat(),
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": int(row["volume"]),
            }
            for _, row in df.iterrows()
        ],
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    await manager.connect(websocket)

    user_data = await verify_jwt_token(token) if token else None
    user_id = user_data.get("sub") if user_data else None

    if not user_id:
        await websocket.close(code=1008, reason="Authentication required")
        manager.disconnect(websocket)
        return

    analyzer = get_market_analyzer()
    if analyzer:
        analyzer.add_target_user(user_id)

    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    finally:
        if analyzer:
            analyzer.remove_target_user(user_id)
        manager.disconnect(websocket)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
