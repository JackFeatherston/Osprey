from fastapi import FastAPI, HTTPException, Header, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Set, Dict, Any
import json
import uvicorn
import asyncio
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from ai_engine import initialize_ai_engine, get_ai_engine
from supabase_client import get_supabase_client, SupabaseClient
from auth_middleware import get_current_user, require_auth, get_user_id
import uuid
from datetime import datetime
import threading

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
        ai_engine = initialize_ai_engine(alpaca_api_key, alpaca_secret_key, db, manager)
        print("AI Engine initialized, starting background task...")
        
        # Start AI engine immediately in background
        ai_task = asyncio.create_task(ai_engine.start())
        app.state.ai_engine = ai_engine
        app.state.ai_task = ai_task
        print("AI Engine background task started")
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
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  
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
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def send_message(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            print(f"Error sending message to WebSocket: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        disconnected_connections = []
        for connection in self.active_connections.copy():
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error broadcasting to WebSocket: {e}")
                disconnected_connections.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected_connections:
            self.disconnect(connection)

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
    
    decision_data = {
        "proposal_id": decision.proposal_id,
        "user_id": proposal["user_id"],
        "decision": decision.decision,
        "notes": getattr(decision, 'notes', None)
    }
    
    created_decision = await db.create_trade_decision(decision_data)
    
    execution_success = False
    
    if decision.decision == "APPROVED":
        ai_engine = get_ai_engine()
        if ai_engine:
            execution_data = {
                "proposal_id": decision.proposal_id,
                "user_id": proposal["user_id"],
                "symbol": proposal["symbol"],
                "action": proposal["action"],
                "quantity": proposal["quantity"],
                "execution_status": "PENDING"
            }
            
            execution_record = await db.create_trade_execution(execution_data)
            execution_result = await ai_engine.execute_trade(proposal)
            
            if execution_result:
                await db.update_trade_execution(execution_record["id"], {
                    "execution_status": "FILLED",
                    "executed_price": proposal["price"],
                    "executed_at": datetime.now().isoformat()
                })
                execution_success = True
    
    log_entry = {
        "proposal_id": decision.proposal_id,
        "symbol": proposal["symbol"],
        "action": proposal["action"],
        "decision": decision.decision,
        "executed": execution_success,
        "timestamp": datetime.now().isoformat()
    }
    
    # Broadcast directly via WebSocket
    await manager.broadcast({
        'type': 'trade_logs',
        'data': log_entry
    })
    
    updated_proposal = await db.get_trade_proposal(decision.proposal_id)
    await manager.broadcast({
        'type': 'proposal_updated',
        'data': updated_proposal
    })
    
    result = {"status": "decision recorded", "decision": decision.decision}
    if decision.decision == "APPROVED":
        result["executed"] = execution_success
    
    return result

@app.get("/decisions")
async def get_decisions(user_id: str = Depends(get_user_id)):
    decisions = await db.get_trade_decisions(user_id)
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

@app.get("/recent-activity")
async def get_recent_activity(limit: int = 10, user_id: str = Depends(get_user_id)):
    """Get recent trading activity"""
    activity = await db.get_recent_activity(user_id, limit)
    return activity

@app.get("/account")
async def get_account_info():
    ai_engine = get_ai_engine()
    account = ai_engine.trading_client.get_account()
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
    
    # Broadcast the clearing to connected clients
    await manager.broadcast({
        'type': 'proposals_cleared',
        'data': {'user_id': user_id, 'cleared_count': cleared_count}
    })
    
    return {"status": "proposals cleared", "count": cleared_count}

@app.post("/ai-engine/start")
async def start_ai_engine_manual():
    """Manually start the AI engine"""
    ai_engine = get_ai_engine()
    if ai_engine:
        if not ai_engine.is_running:
            print("Manually starting AI Engine...")
            ai_task = asyncio.create_task(ai_engine.start())
            app.state.ai_task = ai_task
            return {"status": "AI engine started"}
        else:
            return {"status": "AI engine already running"}
    return {"status": "AI engine not initialized"}

@app.post("/ai-engine/stop") 
async def stop_ai_engine_manual():
    """Manually stop the AI engine"""
    ai_engine = get_ai_engine()
    if ai_engine:
        ai_engine.stop()
        if hasattr(app.state, 'ai_task'):
            app.state.ai_task.cancel()
        return {"status": "AI engine stopped"}
    return {"status": "AI engine not initialized"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    print(f"WebSocket client connected. Total connections: {len(manager.active_connections)}")
    
    user_id = None
    
    try:
        # Send initial connection confirmation
        await manager.send_message(websocket, {
            'type': 'connection',
            'data': {'status': 'connected', 'message': 'Real-time updates active'}
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get('type') == 'ping':
                await manager.send_message(websocket, {
                    'type': 'pong',
                    'data': {
                        'timestamp': datetime.now().isoformat(),
                        'original_timestamp': message.get('timestamp')
                    }
                })
            elif message.get('type') == 'subscribe':
                await manager.send_message(websocket, {
                    'type': 'subscription',
                    'data': {'status': 'subscribed', 'channels': ['trade_proposals', 'trade_logs']}
                })
            elif message.get('type') == 'auth' and message.get('token'):
                # Handle authentication and add user to AI engine targets
                try:
                    # Verify token and get user
                    from auth_middleware import verify_jwt_token
                    user = await verify_jwt_token(message['token'])
                    user_id = user.get('sub') if user else None
                    
                    # Add user to AI engine targets
                    ai_engine = get_ai_engine()
                    if ai_engine and user_id:
                        ai_engine.add_target_user(user_id)
                        print(f"Added user {user_id} to AI engine targets")
                        
                        await manager.send_message(websocket, {
                            'type': 'auth_success',
                            'data': {'user_id': user_id, 'message': 'Authenticated and subscribed to AI proposals'}
                        })
                except Exception as e:
                    print(f"WebSocket auth error: {e}")
                    await manager.send_message(websocket, {
                        'type': 'auth_error',
                        'data': {'error': 'Authentication failed'}
                    })
                
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Remove user from AI engine targets when disconnecting
        if user_id:
            ai_engine = get_ai_engine()
            if ai_engine:
                ai_engine.remove_target_user(user_id)
                print(f"Removed user {user_id} from AI engine targets")
        
        manager.disconnect(websocket)
        print(f"WebSocket client removed. Total connections: {len(manager.active_connections)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)