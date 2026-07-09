"""
FastAPI dependency for authenticated routes.

This module is provider-agnostic: it depends only on Kaito-owned concepts
(UserContext, AuthVerifier, AuthError) and the single allowed infrastructure
composition seam (the verifier factory from the core layer).

It MUST NOT import concrete adapters or any external auth libraries.
Misconfiguration errors from the verifier factory propagate to the app-level handler.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth.provider import get_auth_verifier
from app.modules.auth.context import UserContext
from app.modules.auth.verifier import AuthError, AuthVerifier

_bearer = HTTPBearer(auto_error=False)
_UNAUTHENTICATED = "Not authenticated"


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    verifier: AuthVerifier = Depends(get_auth_verifier),
) -> UserContext:
    """FastAPI dependency yielding a verified UserContext.

    Uses HTTPBearer(auto_error=False) so we produce the exact 401 body
    ourselves rather than relying on FastAPI's default 403/varying messages.

    Missing or malformed credentials raise 401 before verification is attempted.
    AuthError from the verifier maps to 401. AuthConfigError from get_auth_verifier
    propagates out to the app-level 503 exception handler.

    Args:
        credentials: Optional bearer credentials extracted by HTTPBearer.
        verifier:    The wired AuthVerifier implementation.

    Returns:
        Verified UserContext for the authenticated request.

    Raises:
        HTTPException(401): For missing/malformed credentials or invalid token.
    """
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not credentials.credentials
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _UNAUTHENTICATED)
    try:
        return verifier.verify(credentials.credentials)
    except AuthError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _UNAUTHENTICATED)
