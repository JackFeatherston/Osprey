from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import redis
import json
import uvicorn

app = FastAPI()

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
    
    # Log decision
    log_entry = {
        "proposal_id": decision.proposal_id,
        "symbol": proposal.symbol,
        "action": proposal.action,
        "decision": decision.decision,
        "timestamp": decision.dict().get("timestamp")
    }
    
    # Publish to Redis if available
    if redis_client:
        try:
            redis_client.publish("trade_logs", json.dumps(log_entry))
        except Exception as e:
            print(f"Redis publish error: {e}")
    
    return {"status": "decision recorded", "decision": decision.decision}

@app.get("/decisions", response_model=List[dict])
async def get_decisions():
    return decisions

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)