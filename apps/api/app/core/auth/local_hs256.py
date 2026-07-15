"""
Local-development HS256 JWT verifier adapter.

LOCAL DEVELOPMENT ONLY. Local Supabase CLI stacks sign access tokens with a
shared HS256 secret instead of publishing asymmetric JWKS, so
SupabaseJwtVerifier (JWKS-only, by design) cannot verify them. This adapter
verifies HS256 tokens against an explicit, locally-configured shared secret.

Selection is owned exclusively by app.core.auth.provider.get_auth_verifier,
which MUST only construct this verifier when SUPABASE_JWKS_URL is absent —
never alongside JWKS verification. That mutual exclusivity is what prevents
an HS256/RS256 algorithm-confusion attack; this module does not enforce it
itself and must not be constructed directly outside that seam.
"""

import logging

import jwt  # PyJWT

from app.core.config import AuthSettings
from app.modules.auth.context import UserContext
from app.modules.auth.verifier import AuthError

_ALLOWED_ALGS = ["HS256"]

logger = logging.getLogger(__name__)


class LocalHs256JwtVerifier:
    """Verifies local Supabase CLI access tokens via a shared HS256 secret."""

    def __init__(self, settings: AuthSettings) -> None:
        self._secret = settings.local_jwt_secret
        self._settings = settings

    def verify(self, token: str) -> UserContext:
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=_ALLOWED_ALGS,
                audience=self._settings.jwt_audience,
                issuer=self._settings.jwt_issuer,
                options={
                    "verify_aud": self._settings.jwt_audience is not None,
                    "verify_iss": self._settings.jwt_issuer is not None,
                },
            )
        except jwt.PyJWTError as exc:
            logger.warning(
                "Local HS256 JWT verification failed",
                extra={"auth_error_type": type(exc).__name__},
            )
            raise AuthError("token verification failed") from exc

        user_id = claims.get("sub")
        if not user_id:
            raise AuthError("token has no subject")

        email: str | None = claims.get("email")
        return UserContext(user_id=user_id, email=email)
