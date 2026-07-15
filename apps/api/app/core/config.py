"""
Auth configuration settings for the Kaito API.

Reads environment variables at call time (not import time) to preserve
startup tolerance: if SUPABASE_JWKS_URL is absent the module still imports
successfully; protected routes fail via AuthConfigError at request time.

SUPABASE_JWKS_URL provides the explicit JWKS endpoint from Supabase onboarding.
SUPABASE_URL is optional/informational and is NOT used for JWKS URL derivation.
No shared secret is used; verification relies on asymmetric JWT Signing Keys.
The Supabase server-side API key is not used here and must not be added.
"""

import os
from dataclasses import dataclass

DEFAULT_JWKS_CACHE_TTL_SECONDS = 600


@dataclass(frozen=True)
class AuthSettings:
    """Immutable auth configuration snapshot.

    Attributes:
        jwks_url:               Explicit JWKS endpoint URL (from SUPABASE_JWKS_URL).
        supabase_url:           Optional Supabase project base URL (informational only).
        jwt_audience:           Expected token audience. None disables audience check.
        jwt_issuer:             Expected token issuer. None disables issuer check.
        jwks_cache_ttl_seconds: JWKS in-process cache lifetime in seconds.
        local_jwt_secret:       LOCAL DEV ONLY (from SUPABASE_LOCAL_JWT_SECRET).
                                 Selects the HS256 verifier for local Supabase
                                 CLI stacks, which sign tokens with a shared
                                 secret instead of publishing JWKS. Ignored
                                 whenever jwks_url is set — JWKS always wins.
    """

    jwks_url: str
    supabase_url: str | None = None
    jwt_audience: str | None = "authenticated"
    jwt_issuer: str | None = None
    jwks_cache_ttl_seconds: int = DEFAULT_JWKS_CACHE_TTL_SECONDS
    local_jwt_secret: str | None = None


@dataclass(frozen=True)
class DatabaseSettings:
    url: str
    expected_role: str


@dataclass(frozen=True)
class WebSettings:
    """Browser origins allowed to call this API directly (CORS).

    Empty by default (fail closed): no cross-origin browser access until
    KAITO_WEB_ORIGIN is explicitly configured.
    """

    allowed_origins: tuple[str, ...] = ()


def get_auth_settings() -> AuthSettings:
    """Read auth settings from environment at call time.

    Returns:
        AuthSettings built from current environment variables.

    Note:
        jwks_url may be empty; callers (get_auth_verifier) are responsible
        for detecting and signalling misconfiguration via AuthConfigError.
        SUPABASE_URL is optional/informational; it is not required.
    """
    jwks_url = (os.getenv("SUPABASE_JWKS_URL") or "").strip()

    raw_supabase_url = (os.getenv("SUPABASE_URL") or "").strip()
    supabase_url: str | None = raw_supabase_url if raw_supabase_url else None

    raw_audience = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    stripped_audience = raw_audience.strip() if raw_audience else ""
    audience: str | None = stripped_audience if stripped_audience else None

    raw_issuer = os.getenv("SUPABASE_JWT_ISSUER", "")
    stripped_issuer = raw_issuer.strip() if raw_issuer else ""
    issuer: str | None = stripped_issuer if stripped_issuer else None

    raw_ttl = os.getenv(
        "SUPABASE_JWKS_CACHE_TTL_SECONDS",
        str(DEFAULT_JWKS_CACHE_TTL_SECONDS),
    )
    try:
        parsed_ttl = int(raw_ttl.strip()) if raw_ttl else DEFAULT_JWKS_CACHE_TTL_SECONDS
    except ValueError:
        parsed_ttl = DEFAULT_JWKS_CACHE_TTL_SECONDS
    ttl = parsed_ttl if parsed_ttl > 0 else DEFAULT_JWKS_CACHE_TTL_SECONDS

    raw_local_secret = (os.getenv("SUPABASE_LOCAL_JWT_SECRET") or "").strip()
    local_jwt_secret: str | None = raw_local_secret if raw_local_secret else None

    return AuthSettings(
        jwks_url=jwks_url,
        supabase_url=supabase_url,
        jwt_audience=audience,
        jwt_issuer=issuer,
        jwks_cache_ttl_seconds=ttl,
        local_jwt_secret=local_jwt_secret,
    )


def get_database_settings() -> DatabaseSettings:
    url = (os.getenv("DATABASE_URL") or "").strip()
    role = (os.getenv("DATABASE_EXPECTED_ROLE") or "").strip()
    if not url or role != "kaito_api_login":
        raise ValueError("database_unavailable")
    return DatabaseSettings(url=url, expected_role=role)


def get_web_settings() -> WebSettings:
    """Read the CORS-allowed web origin(s) from KAITO_WEB_ORIGIN.

    Accepts a comma-separated list. Leave unset to keep browser access
    fully disabled (fail closed).
    """
    raw = os.getenv("KAITO_WEB_ORIGIN") or ""
    origins = tuple(origin.strip() for origin in raw.split(",") if origin.strip())
    return WebSettings(allowed_origins=origins)
