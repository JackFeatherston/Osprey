"""
Supabase client for the trading assistant backend.
Handles database operations for trade proposals, decisions, and executions.
"""

from supabase import create_client, Client
from typing import List, Dict, Optional, Any
import os
from datetime import datetime, timedelta
import logging
import uuid

logger = logging.getLogger(__name__)

class SupabaseClient:
    def __init__(self):
        """Initialize Supabase client"""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        
        self.client: Client = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialized")
    
    # Trade Proposals Methods
    
    async def create_trade_proposal(self, proposal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new trade proposal"""
        if 'expires_at' not in proposal_data:
            proposal_data['expires_at'] = (datetime.now() + timedelta(hours=1)).isoformat()
        
        result = self.client.table("trade_proposals").insert(proposal_data).execute()
        return result.data[0]
    
    async def get_trade_proposals(self, user_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get trade proposals, optionally filtered by user and status"""
        query = self.client.table("trade_proposals").select("*")
        
        if user_id:
            query = query.eq("user_id", user_id)
        if status:
            query = query.eq("status", status)
        
        result = query.order("created_at", desc=True).execute()
        return result.data or []
    
    async def get_trade_proposal(self, proposal_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific trade proposal by ID"""
        result = self.client.table("trade_proposals").select("*").eq("id", proposal_id).execute()
        return result.data[0] if result.data else None
    
    async def update_trade_proposal_status(self, proposal_id: str, status: str) -> bool:
        """Update trade proposal status"""
        result = self.client.table("trade_proposals").update({"status": status}).eq("id", proposal_id).execute()
        return len(result.data) > 0
    
    # Trade Decisions Methods
    
    async def create_trade_decision(self, decision_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a trade decision"""
        result = self.client.table("trade_decisions").insert(decision_data).execute()
        
        proposal_id = decision_data["proposal_id"]
        status = "APPROVED" if decision_data["decision"] == "APPROVED" else "REJECTED"
        await self.update_trade_proposal_status(proposal_id, status)
        
        return result.data[0]
    
    async def get_trade_decisions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get trade decisions, optionally filtered by user"""
        query = self.client.table("trade_decisions").select("*")
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        result = query.order("created_at", desc=True).execute()
        return result.data or []
    
    # Trade Executions Methods
    
    async def create_trade_execution(self, execution_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a trade execution record"""
        result = self.client.table("trade_executions").insert(execution_data).execute()
        return result.data[0]
    
    async def update_trade_execution(self, execution_id: str, update_data: Dict[str, Any]) -> bool:
        """Update a trade execution record"""
        result = self.client.table("trade_executions").update(update_data).eq("id", execution_id).execute()
        return len(result.data) > 0
    
    async def get_trade_executions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get trade executions, optionally filtered by user"""
        query = self.client.table("trade_executions").select("*")
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        result = query.order("created_at", desc=True).execute()
        return result.data or []
    
    # User Settings Methods
    
    async def get_user_settings(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user settings"""
        result = self.client.table("user_settings").select("*").eq("user_id", user_id).execute()
        return result.data[0] if result.data else None
    
    async def update_user_settings(self, user_id: str, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user settings"""
        result = self.client.table("user_settings").update(settings_data).eq("user_id", user_id).execute()
        
        if result.data:
            return result.data[0]
        else:
            settings_data["user_id"] = user_id
            result = self.client.table("user_settings").insert(settings_data).execute()
            return result.data[0]
    
    # Market Data Methods
    
    async def update_market_data(self, symbol: str, price: float, volume: Optional[int] = None, 
                               change_percent: Optional[float] = None) -> Dict[str, Any]:
        """Update market data for a symbol"""
        data = {
            "symbol": symbol,
            "price": price,
            "updated_at": datetime.now().isoformat()
        }
        
        if volume is not None:
            data["volume"] = volume
        if change_percent is not None:
            data["change_percent"] = change_percent
        
        result = self.client.table("market_data").upsert(data).execute()
        return result.data[0]
    
    async def get_market_data(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get market data, optionally for a specific symbol"""
        query = self.client.table("market_data").select("*")
        
        if symbol:
            query = query.eq("symbol", symbol)
        
        result = query.order("updated_at", desc=True).execute()
        return result.data or []
    
    # Analytics and Reporting Methods
    
    async def get_user_portfolio_summary(self, user_id: str) -> Dict[str, Any]:
        """Get user portfolio summary using the view"""
        result = self.client.table("user_portfolio_summary").select("*").eq("user_id", user_id).execute()
        
        if result.data:
            return result.data[0]
        else:
            return {
                "user_id": user_id,
                "total_trades": 0,
                "buy_trades": 0,
                "sell_trades": 0,
                "total_trade_volume": 0
            }
    
    async def get_recent_activity(self, user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent trade activity using the view"""
        query = self.client.table("recent_trade_activity").select("*")
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        result = query.limit(limit).execute()
        return result.data or []
    
    async def get_active_proposals(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get active (pending and not expired) proposals using the view"""
        query = self.client.table("active_proposals").select("*")
        
        if user_id:
            query = query.eq("user_id", user_id)
        
        result = query.order("created_at", desc=True).execute()
        return result.data or []
    
    # Utility Methods
    
    async def expire_old_proposals(self) -> int:
        """Expire old proposals by calling the database function"""
        self.client.rpc("expire_old_proposals").execute()
        return 0

# Singleton instance
supabase_client: Optional[SupabaseClient] = None

def get_supabase_client() -> SupabaseClient:
    """Get or create the Supabase client singleton"""
    global supabase_client
    if supabase_client is None:
        supabase_client = SupabaseClient()
    return supabase_client