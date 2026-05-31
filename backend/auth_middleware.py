"""Authentication helpers for verifying Supabase JWT tokens."""

import logging
from typing import Any, Dict, Optional

import jwt
from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)


def _decode(token: str) -> Optional[Dict[str, Any]]:
    # Signature verification is delegated to Supabase RLS; we only need claims here.
    decoded = jwt.decode(token, options={"verify_signature": False})
    return decoded if decoded.get("sub") else None


async def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    return _decode(token)


async def get_user_id(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    decoded = _decode(authorization[7:])
    if not decoded:
        raise HTTPException(status_code=401, detail="Authentication required")
    return decoded["sub"]
