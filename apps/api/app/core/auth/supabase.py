"""
Supabase JWT verification adapter (JWKS / asymmetric signing keys).

This is the ONLY module allowed to know Supabase claim names, the JWKS
endpoint, and JWT verification internals. All provider-specific knowledge is
confined here.

Verification uses PyJWT's PyJWKClient to fetch the project JWKS, select the
signing key whose kid matches the token header kid, and verify the asymmetric
signature. No shared secret is used.

Maps Supabase token claims to the canonical Kaito UserContext:
  sub   -> user_id (required; absence is an auth failure)
  email -> email   (optional; absence is allowed)
"""

import logging

import jwt  # PyJWT
from jwt import PyJWKClient

from app.core.config import AuthSettings
from app.modules.auth.context import UserContext
from app.modules.auth.verifier import AuthError

# Asymmetric algorithms Supabase signing keys may advertise.
# HS* and "none" are intentionally excluded to prevent algorithm-confusion attacks.
_ALLOWED_ALGS = ["ES256", "RS256", "EdDSA"]

logger = logging.getLogger(__name__)


class SupabaseJwtVerifier:
    """Verifies Supabase access tokens via JWKS asymmetric signing keys.

    The only place that knows Supabase claim names (sub, email, aud), the
    JWKS endpoint, and PyJWT JWKS client details. Callers receive only the
    canonical UserContext.
    """

    def __init__(self, settings: AuthSettings) -> None:
        self._settings = settings
        # PyJWKClient caches keys in-process and refreshes on kid miss.
        self._jwk_client = PyJWKClient(
            settings.jwks_url,
            cache_keys=True,
            lifespan=settings.jwks_cache_ttl_seconds,
        )

    def verify(self, token: str) -> UserContext:
        """Verify token using JWKS asymmetric key and return a canonical UserContext.

        Args:
            token: Raw bearer token string.

        Returns:
            UserContext with user_id from 'sub' and optional email.

        Raises:
            AuthError: For any verification failure (bad/unknown key, expired,
                       malformed, wrong audience/issuer, missing/empty sub,
                       disallowed algorithm).
        """
        try:
            signing_key = self._jwk_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=_ALLOWED_ALGS,
                audience=self._settings.jwt_audience,
                issuer=self._settings.jwt_issuer,
                options={
                    "verify_aud": self._settings.jwt_audience is not None,
                    "verify_iss": self._settings.jwt_issuer is not None,
                },
            )
        except (jwt.PyJWTError, jwt.exceptions.PyJWKClientError) as exc:
            logger.warning(
                "JWT verification failed",
                extra={"auth_error_type": type(exc).__name__},
            )
            raise AuthError("token verification failed") from exc

        user_id = claims.get("sub")
        if not user_id:
            raise AuthError("token has no subject")

        email: str | None = claims.get("email")
        return UserContext(user_id=user_id, email=email)
