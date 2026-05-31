"""Supabase REST client over aiohttp."""

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)


class SupabaseClient:
    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SECRET_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set")

        self.rest_url = f"{url.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self.session: Optional[aiohttp.ClientSession] = None

    async def _session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(headers=self.headers)
        return self.session

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> Any:
        session = await self._session()
        async with session.request(method, f"{self.rest_url}{path}", params=params, json=json, headers=headers) as response:
            response.raise_for_status()
            return await response.json()

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()

    # --- trade proposals ---

    async def create_trade_proposal(self, data: Dict[str, Any]) -> Dict[str, Any]:
        data.setdefault("expires_at", (datetime.now() + timedelta(hours=1)).isoformat())
        result = await self._request("POST", "/trade_proposals", json=data)
        return result[0] if isinstance(result, list) else result

    async def get_trade_proposals(self, user_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"select": "*", "order": "created_at.desc"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        if status:
            params["status"] = f"eq.{status}"
        return await self._request("GET", "/trade_proposals", params=params)

    async def get_trade_proposal(self, proposal_id: str) -> Optional[Dict[str, Any]]:
        result = await self._request("GET", "/trade_proposals", params={"select": "*", "id": f"eq.{proposal_id}"})
        return result[0] if result else None

    async def update_trade_proposal_status(self, proposal_id: str, status: str) -> bool:
        result = await self._request(
            "PATCH", "/trade_proposals",
            params={"id": f"eq.{proposal_id}"},
            json={"status": status},
        )
        return len(result) > 0

    async def clear_pending_proposals(self, user_id: str) -> int:
        result = await self._request(
            "PATCH", "/trade_proposals",
            params={"user_id": f"eq.{user_id}", "status": "eq.PENDING"},
            json={"status": "EXPIRED"},
        )
        return len(result)

    # --- trade decisions ---

    async def create_trade_decision(self, data: Dict[str, Any]) -> Dict[str, Any]:
        result = await self._request("POST", "/trade_decisions", json=data)
        status = "APPROVED" if data["decision"] == "APPROVED" else "REJECTED"
        await self.update_trade_proposal_status(data["proposal_id"], status)
        return result[0] if isinstance(result, list) else result

    async def get_trade_decisions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"select": "*", "order": "created_at.desc"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        return await self._request("GET", "/trade_decisions", params=params)

    # --- trade executions ---

    async def create_trade_execution(self, data: Dict[str, Any]) -> Dict[str, Any]:
        result = await self._request("POST", "/trade_executions", json=data)
        return result[0] if isinstance(result, list) else result

    async def update_trade_execution(self, execution_id: str, data: Dict[str, Any]) -> bool:
        result = await self._request(
            "PATCH", "/trade_executions",
            params={"id": f"eq.{execution_id}"},
            json=data,
        )
        return len(result) > 0

    async def get_trade_executions(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"select": "*", "order": "created_at.desc"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        return await self._request("GET", "/trade_executions", params=params)

    # --- user settings ---

    async def get_user_settings(self, user_id: str) -> Optional[Dict[str, Any]]:
        result = await self._request("GET", "/user_settings", params={"select": "*", "user_id": f"eq.{user_id}"})
        return result[0] if result else None

    async def update_user_settings(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        session = await self._session()
        async with session.patch(
            f"{self.rest_url}/user_settings",
            params={"user_id": f"eq.{user_id}"},
            json=data,
        ) as response:
            if response.status == 200:
                result = await response.json()
                return result[0] if isinstance(result, list) else result

        # No row to update — insert one.
        data["user_id"] = user_id
        result = await self._request("POST", "/user_settings", json=data)
        return result[0] if isinstance(result, list) else result

    # --- market data ---

    async def update_market_data(
        self,
        symbol: str,
        price: float,
        volume: Optional[int] = None,
        change_percent: Optional[float] = None,
    ) -> Dict[str, Any]:
        data = {"symbol": symbol, "price": price, "updated_at": datetime.now().isoformat()}
        if volume is not None:
            data["volume"] = volume
        if change_percent is not None:
            data["change_percent"] = change_percent

        result = await self._request(
            "POST", "/market_data",
            json=data,
            headers={**self.headers, "Prefer": "resolution=merge-duplicates"},
        )
        return result[0] if isinstance(result, list) else result

    async def get_market_data(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"select": "*", "order": "updated_at.desc"}
        if symbol:
            params["symbol"] = f"eq.{symbol}"
        return await self._request("GET", "/market_data", params=params)

    # --- analytics ---

    async def get_user_portfolio_summary(self, user_id: str) -> Dict[str, Any]:
        result = await self._request("GET", "/user_portfolio_summary", params={"select": "*", "user_id": f"eq.{user_id}"})
        if result:
            return result[0]
        return {"user_id": user_id, "total_trades": 0, "buy_trades": 0, "sell_trades": 0, "total_trade_volume": 0}

    async def get_active_proposals(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"select": "*", "order": "created_at.desc"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        return await self._request("GET", "/active_proposals", params=params)

    async def get_order_history(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {"select": "*, trade_proposals!inner(*)", "order": "created_at.desc"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"

        try:
            decisions = await self._request("GET", "/trade_decisions", params=params)
        except aiohttp.ClientResponseError as e:
            logger.warning(f"Failed to fetch order history: {e}")
            return []

        proposal_ids = [d["proposal_id"] for d in decisions if d.get("proposal_id")]
        executions_by_proposal: Dict[str, Dict] = {}
        if proposal_ids:
            executions = await self._request(
                "GET", "/trade_executions",
                params={"select": "*", "proposal_id": f"in.({','.join(proposal_ids)})"},
            )
            for execution in executions:
                executions_by_proposal[execution.get("proposal_id")] = execution

        result = []
        for decision in decisions:
            proposal = decision.get("trade_proposals", {})
            execution = executions_by_proposal.get(decision.get("proposal_id"), {})
            result.append({
                "decision_id": decision.get("id"),
                "proposal_id": decision.get("proposal_id"),
                "symbol": proposal.get("symbol"),
                "action": proposal.get("action"),
                "quantity": proposal.get("quantity"),
                "price": proposal.get("price"),
                "total_value": proposal.get("price", 0) * proposal.get("quantity", 0),
                "reason": proposal.get("reason"),
                "strategy": proposal.get("strategy"),
                "decision": decision.get("decision"),
                "decision_notes": decision.get("notes"),
                "decided_at": decision.get("created_at"),
                "decision_at": decision.get("created_at"),
                "proposed_at": proposal.get("created_at"),
                "execution_status": execution.get("execution_status"),
                "executed_price": execution.get("executed_price"),
                "executed_at": execution.get("executed_at"),
                "user_id": decision.get("user_id"),
            })
        return result

    async def expire_old_proposals(self) -> int:
        await self._request("POST", "/rpc/expire_old_proposals")
        return 0


_instance: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    global _instance
    if _instance is None:
        _instance = SupabaseClient()
    return _instance
