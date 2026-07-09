"""
Auth verifier factory — single wiring point for the verification strategy.

get_auth_verifier() is the composition seam: it reads settings and returns
the wired concrete AuthVerifier. This is the only place that decides which
adapter to construct.

Future strategy: add a new adapter in app/core/auth/ and select it here based
on a settings switch. The boundary, UserContext, dependency, and route handler
remain unchanged.
"""

import logging
from threading import Lock

from app.core.auth.errors import AuthConfigError
from app.core.auth.supabase import SupabaseJwtVerifier
from app.core.config import AuthSettings, get_auth_settings
from app.modules.auth.verifier import AuthVerifier

logger = logging.getLogger(__name__)

_VERIFIER_CACHE: dict[AuthSettings, AuthVerifier] = {}
_VERIFIER_CACHE_LOCK = Lock()


def reset_auth_verifier_cache() -> None:
    """Clear cached verifier instances; intended for tests and config changes."""
    with _VERIFIER_CACHE_LOCK:
        _VERIFIER_CACHE.clear()


def get_auth_verifier() -> AuthVerifier:
    """Return the configured auth verifier.

    Reads settings at call time so the app boots without SUPABASE_JWKS_URL.

    Returns:
        The wired AuthVerifier implementation.

    Raises:
        AuthConfigError: When SUPABASE_JWKS_URL is absent or empty.
    """
    settings = get_auth_settings()
    if not settings.jwks_url:
        logger.error("Authentication verifier is not configured")
        raise AuthConfigError("Authentication is not configured")

    with _VERIFIER_CACHE_LOCK:
        verifier = _VERIFIER_CACHE.get(settings)
        if verifier is None:
            verifier = SupabaseJwtVerifier(settings)
            _VERIFIER_CACHE[settings] = verifier
        return verifier
