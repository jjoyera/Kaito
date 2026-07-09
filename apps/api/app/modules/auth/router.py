"""
Auth router — exposes the GET /auth/me endpoint.

Provider-agnostic: depends only on Kaito auth concepts (UserContext, schemas,
get_current_user). No Supabase types, JWT internals, or provider claim names.
"""

from fastapi import APIRouter, Depends

from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.schemas import MeResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=MeResponse)
def read_current_user(user: UserContext = Depends(get_current_user)) -> MeResponse:
    """Return the authenticated user's canonical identity.

    Requires a valid bearer token. Returns user_id and optional email only.
    No provider fields, raw claims, or domain state are included.
    """
    return MeResponse(user_id=user.user_id, email=user.email)
