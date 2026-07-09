"""
Response schemas for the auth module.

Provider-agnostic: MUST NOT include provider-specific fields, raw claims,
or infrastructure types. Only canonical identity fields derived from UserContext.
"""

from pydantic import BaseModel


class MeResponse(BaseModel):
    """Identity-only response for GET /auth/me.

    Contains exactly the canonical user identity: user_id (required) and
    email (optional). No provider fields, raw token claims, roles, or domain
    state are included.
    """

    user_id: str
    email: str | None = None
