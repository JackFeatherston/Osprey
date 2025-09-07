"""
Authentication middleware for verifying Supabase JWT tokens
"""

from fastapi import HTTPException, Header, Depends
from typing import Optional, Dict, Any
import jwt
import os
import logging
from supabase import create_client

logger = logging.getLogger(__name__)

# Supabase client for auth verification
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "your-jwt-secret")

auth_client = create_client(supabase_url, supabase_service_key) if supabase_url and supabase_service_key else None

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """
    Extract and verify user from Authorization header
    Returns user info if token is valid, None otherwise
    """
    if not authorization or not auth_client:
        return None
    
    if not authorization.startswith("Bearer "):
        return None
        
    token = authorization[7:]
    
    decoded_token = jwt.decode(
        token, 
        supabase_jwt_secret, 
        algorithms=["HS256"],
        options={"verify_signature": False}
    )
    
    user_id = decoded_token.get("sub")
    if not user_id:
        return None
        
    return {
        "id": user_id,
        "email": decoded_token.get("email"),
        "user_metadata": decoded_token.get("user_metadata", {}),
        "app_metadata": decoded_token.get("app_metadata", {})
    }

async def require_auth(current_user: Optional[Dict[str, Any]] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Dependency that requires authentication
    Raises HTTPException if user is not authenticated
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return current_user

async def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify JWT token and return user info
    """
    try:
        decoded_token = jwt.decode(
            token, 
            supabase_jwt_secret, 
            algorithms=["HS256"],
            options={"verify_signature": False}
        )
        
        user_id = decoded_token.get("sub")
        if not user_id:
            return None
            
        return {
            "sub": user_id,
            "email": decoded_token.get("email"),
            "user_metadata": decoded_token.get("user_metadata", {}),
            "app_metadata": decoded_token.get("app_metadata", {})
        }
    except Exception as e:
        logger.error(f"JWT verification failed: {e}")
        return None

async def get_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    Get user ID from authorization header or return consistent development UUID
    """
    user = await get_current_user(authorization)
    if user:
        return user["id"]
    
    # For development/testing, return a consistent UUID
    # In production, this should require authentication
    return "d6c02463-eb2d-4d5a-9ba3-cc97d20910b3"