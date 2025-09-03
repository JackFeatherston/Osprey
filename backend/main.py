from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import redis
import json
import uvicorn
import asyncio
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from ai_engine import initialize_ai_engine, get_ai_engine

# Load environment variables
load_dotenv()

# Lifespan manager for AI engine
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    alpaca_api_key = os.getenv("ALPACA_API_KEY")
    alpaca_secret_key = os.getenv("ALPACA_SECRET_KEY")
    
    if alpaca_api_key and alpaca_secret_key:
        print("Initializing AI Engine...")
        ai_engine = initialize_ai_engine(alpaca_api_key, alpaca_secret_key, redis_client)
        # Start AI engine in background
        ai_task = asyncio.create_task(ai_engine.start())
        app.state.ai_task = ai_task
        print("AI Engine started")
    else:
        print("Warning: Alpaca credentials not found. AI Engine disabled.")
    
    yield
    
    # Shutdown
    if hasattr(app.state, 'ai_task'):
        ai_engine = get_ai_engine()
        if ai_engine:
            ai_engine.stop()
        app.state.ai_task.cancel()
        try:
            await app.state.ai_task
        except asyncio.CancelledError:
            pass
        print("AI Engine stopped")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis client for pub/sub
try:
    redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
    redis_client.ping()
except redis.ConnectionError:
    print("Warning: Redis connection failed. Running without Redis.")
    redis_client = None

# Data models
class TradeProposal(BaseModel):
    id: str
    symbol: str
    action: str  # "BUY" or "SELL"
    quantity: int
    price: float
    reason: str
    timestamp: str

class TradeDecision(BaseModel):
    proposal_id: str
    decision: str  # "APPROVED" or "REJECTED"
    user_id: Optional[str] = None

# In-memory storage for demo (replace with Supabase later)
proposals = []
decisions = []

@app.get("/")
async def root():
    return {"message": "Trading Assistant API", "status": "running"}

@app.get("/health")
async def health_check():
    redis_status = "connected" if redis_client else "disconnected"
    return {"status": "healthy", "redis": redis_status}

@app.get("/proposals", response_model=List[TradeProposal])
async def get_proposals():
    return proposals

@app.post("/proposals")
async def create_proposal(proposal: TradeProposal):
    proposals.append(proposal)
    
    # Publish to Redis if available
    if redis_client:
        try:
            redis_client.publish("trade_proposals", json.dumps(proposal.dict()))
        except Exception as e:
            print(f"Redis publish error: {e}")
    
    return {"status": "proposal created", "id": proposal.id}

@app.post("/decisions")
async def submit_decision(decision: TradeDecision):
    decisions.append(decision)
    
    # Find the proposal
    proposal = next((p for p in proposals if p.id == decision.proposal_id), None)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Execute trade if approved
    execution_success = False
    if decision.decision == "APPROVED":
        ai_engine = get_ai_engine()
        if ai_engine:
            try:
                execution_success = await ai_engine.execute_trade(proposal.dict())
            except Exception as e:
                print(f"Trade execution error: {e}")
    
    # Log decision
    log_entry = {
        "proposal_id": decision.proposal_id,
        "symbol": proposal.symbol,
        "action": proposal.action,
        "decision": decision.decision,
        "executed": execution_success,
        "timestamp": decision.dict().get("timestamp", "")
    }
    
    # Publish to Redis if available
    if redis_client:
        try:
            redis_client.publish("trade_logs", json.dumps(log_entry))
        except Exception as e:
            print(f"Redis publish error: {e}")
    
    result = {"status": "decision recorded", "decision": decision.decision}
    if decision.decision == "APPROVED":
        result["executed"] = execution_success
    
    return result

@app.get("/decisions", response_model=List[dict])
async def get_decisions():
    return decisions

@app.get("/ai-status")
async def get_ai_status():
    ai_engine = get_ai_engine()
    if ai_engine:
        return {
            "status": "running" if ai_engine.is_running else "stopped",
            "watchlist": ai_engine.watchlist,
            "strategies": [strategy.name for strategy in ai_engine.strategies]
        }
    return {"status": "not initialized"}

@app.get("/account")
async def get_account_info():
    ai_engine = get_ai_engine()
    if ai_engine:
        try:
            account = ai_engine.trading_client.get_account()
            return {
                "account_id": account.id,
                "buying_power": float(account.buying_power),
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "status": account.status
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get account info: {e}")
    raise HTTPException(status_code=503, detail="AI Engine not initialized")

@app.post("/ai-control")
async def control_ai_engine(action: str):
    ai_engine = get_ai_engine()
    if not ai_engine:
        raise HTTPException(status_code=503, detail="AI Engine not initialized")
    
    if action == "start":
        if not ai_engine.is_running:
            task = asyncio.create_task(ai_engine.start())
            return {"status": "AI Engine started"}
        return {"status": "AI Engine already running"}
    elif action == "stop":
        ai_engine.stop()
        return {"status": "AI Engine stopped"}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'start' or 'stop'")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)