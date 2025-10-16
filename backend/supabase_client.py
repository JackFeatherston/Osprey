"""
Supabase client for the trading assistant backend.
Handles database operations for trade proposals, decisions, and executions.
Uses async HTTP (aiohttp) instead of blocking SDK for proper async/await support.
"""

import aiohttp
from typing import List, Dict, Optional, Any
import os
from datetime import datetime, timedelta
import logging
import uuid

logger = logging.getLogger(__name__)

class SupabaseClient:
    def __init__(self):
        """Initialize Supabase client with async HTTP"""
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

        # Remove trailing slash if present
        self.supabase_url = self.supabase_url.rstrip('/')
        self.rest_url = f"{self.supabase_url}/rest/v1"

        # Headers for Supabase REST API
        self.headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

        # Create persistent session
        self.session: Optional[aiohttp.ClientSession] = None
        logger.info("Supabase client initialized")

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(headers=self.headers)
        return self.session

    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    # Trade Proposals Methods

    async def create_trade_proposal(self, proposal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new trade proposal"""
        if 'expires_at' not in proposal_data:
            proposal_data['expires_at'] = (datetime.now() + timedelta(hours=1)).isoformat()

        session = await self._get_session()
        async with session.post(f"{self.rest_url}/trade_proposals", json=proposal_data) as response:
            response.raise_for_status()
            data = await response.json()
            return data[0] if isinstance(data, list) else data
    
    async def get_trade_proposals(self, user_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get trade proposals, optionally filtered by user and status"""
        params = {"select": "*", "order": "created_at.desc"}

        if user_id:
            params["user_id"] = f"eq.{user_id}"
        if status:
            params["status"] = f"eq.{status}"

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/trade_proposals", params=params) as response:
            response.raise_for_status()
            return await response.json()
    
    async def get_trade_proposal(self, proposal_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific trade proposal by ID"""
        params = {"select": "*", "id": f"eq.{proposal_id}"}

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/trade_proposals", params=params) as response:
            response.raise_for_status()
            data = await response.json()
            return data[0] if data else None
    
    async def update_trade_proposal_status(self, proposal_id: str, status: str) -> bool:
        """Update trade proposal status"""
        params = {"id": f"eq.{proposal_id}"}
        update_data = {"status": status}

        session = await self._get_session()
        async with session.patch(f"{self.rest_url}/trade_proposals", params=params, json=update_data) as response:
            response.raise_for_status()
            data = await response.json()
            return len(data) > 0
    
    async def clear_pending_proposals(self, user_id: str) -> int:
        """Clear all pending proposals for a user by updating their status to EXPIRED"""
        params = {"user_id": f"eq.{user_id}", "status": "eq.PENDING"}
        update_data = {"status": "EXPIRED"}

        session = await self._get_session()
        async with session.patch(f"{self.rest_url}/trade_proposals", params=params, json=update_data) as response:
            response.raise_for_status()
            data = await response.json()
            return len(data)
    
    # Trade Decisions Methods

    async def create_trade_decision(self, decision_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a trade decision"""
        session = await self._get_session()
        async with session.post(f"{self.rest_url}/trade_decisions", json=decision_data) as response:
            response.raise_for_status()
            data = await response.json()

        proposal_id = decision_data["proposal_id"]
        status = "APPROVED" if decision_data["decision"] == "APPROVED" else "REJECTED"
        await self.update_trade_proposal_status(proposal_id, status)

        return data[0] if isinstance(data, list) else data
    
    async def get_trade_decisions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get trade decisions, optionally filtered by user"""
        params = {"select": "*", "order": "created_at.desc"}

        if user_id:
            params["user_id"] = f"eq.{user_id}"

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/trade_decisions", params=params) as response:
            response.raise_for_status()
            return await response.json()
    
    # Trade Executions Methods

    async def create_trade_execution(self, execution_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a trade execution record"""
        session = await self._get_session()
        async with session.post(f"{self.rest_url}/trade_executions", json=execution_data) as response:
            response.raise_for_status()
            data = await response.json()
            return data[0] if isinstance(data, list) else data

    async def update_trade_execution(self, execution_id: str, update_data: Dict[str, Any]) -> bool:
        """Update a trade execution record"""
        params = {"id": f"eq.{execution_id}"}

        session = await self._get_session()
        async with session.patch(f"{self.rest_url}/trade_executions", params=params, json=update_data) as response:
            response.raise_for_status()
            data = await response.json()
            return len(data) > 0

    async def get_trade_executions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get trade executions, optionally filtered by user"""
        params = {"select": "*", "order": "created_at.desc"}

        if user_id:
            params["user_id"] = f"eq.{user_id}"

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/trade_executions", params=params) as response:
            response.raise_for_status()
            return await response.json()
    
    # User Settings Methods

    async def get_user_settings(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user settings"""
        params = {"select": "*", "user_id": f"eq.{user_id}"}

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/user_settings", params=params) as response:
            response.raise_for_status()
            data = await response.json()
            return data[0] if data else None

    async def update_user_settings(self, user_id: str, settings_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user settings"""
        params = {"user_id": f"eq.{user_id}"}

        session = await self._get_session()
        async with session.patch(f"{self.rest_url}/user_settings", params=params, json=settings_data) as response:
            if response.status == 200:
                data = await response.json()
                return data[0] if isinstance(data, list) else data
            else:
                # No existing record, create one
                settings_data["user_id"] = user_id
                async with session.post(f"{self.rest_url}/user_settings", json=settings_data) as insert_response:
                    insert_response.raise_for_status()
                    data = await insert_response.json()
                    return data[0] if isinstance(data, list) else data
    
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

        session = await self._get_session()
        # Upsert using Prefer: resolution=merge-duplicates header
        headers = {**self.headers, "Prefer": "resolution=merge-duplicates"}
        async with session.post(f"{self.rest_url}/market_data", json=data, headers=headers) as response:
            response.raise_for_status()
            result = await response.json()
            return result[0] if isinstance(result, list) else result

    async def get_market_data(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get market data, optionally for a specific symbol"""
        params = {"select": "*", "order": "updated_at.desc"}

        if symbol:
            params["symbol"] = f"eq.{symbol}"

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/market_data", params=params) as response:
            response.raise_for_status()
            return await response.json()
    
    # Analytics and Reporting Methods

    async def get_user_portfolio_summary(self, user_id: str) -> Dict[str, Any]:
        """Get user portfolio summary using the view"""
        params = {"select": "*", "user_id": f"eq.{user_id}"}

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/user_portfolio_summary", params=params) as response:
            response.raise_for_status()
            data = await response.json()

            if data:
                return data[0]
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
        params = {"select": "*", "limit": str(limit)}

        if user_id:
            params["user_id"] = f"eq.{user_id}"

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/recent_trade_activity", params=params) as response:
            response.raise_for_status()
            return await response.json()

    async def get_active_proposals(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get active (pending and not expired) proposals using the view"""
        params = {"select": "*", "order": "created_at.desc"}

        if user_id:
            params["user_id"] = f"eq.{user_id}"

        session = await self._get_session()
        async with session.get(f"{self.rest_url}/active_proposals", params=params) as response:
            response.raise_for_status()
            return await response.json()

    # Utility Methods

    async def expire_old_proposals(self) -> int:
        """Expire old proposals by calling the database function"""
        session = await self._get_session()
        async with session.post(f"{self.rest_url}/rpc/expire_old_proposals") as response:
            response.raise_for_status()
            return 0

# Singleton instance
supabase_client: Optional[SupabaseClient] = None

def get_supabase_client() -> SupabaseClient:
    """Get or create the Supabase client singleton"""
    global supabase_client
    if supabase_client is None:
        supabase_client = SupabaseClient()
    return supabase_client