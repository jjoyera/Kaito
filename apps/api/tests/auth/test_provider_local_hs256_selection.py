"""
Verifier-selection guard: JWKS always wins over the local HS256 escape hatch.

This is the mutual-exclusivity boundary that prevents an HS256/RS256
algorithm-confusion vulnerability: the local verifier must never be
constructible while SUPABASE_JWKS_URL is configured.
"""

import pytest

from app.core.auth.local_hs256 import LocalHs256JwtVerifier
from app.core.auth.provider import get_auth_verifier, reset_auth_verifier_cache
from app.core.auth.supabase import SupabaseJwtVerifier


@pytest.fixture(autouse=True)
def _isolated_verifier_cache():
    reset_auth_verifier_cache()
    yield
    reset_auth_verifier_cache()


def test_selects_local_hs256_verifier_when_only_local_secret_is_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.setenv("SUPABASE_LOCAL_JWT_SECRET", "local-dev-secret-value")

    verifier = get_auth_verifier()

    assert isinstance(verifier, LocalHs256JwtVerifier)


def test_jwks_always_wins_when_both_are_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "SUPABASE_JWKS_URL", "https://example.supabase.co/auth/v1/.well-known/jwks.json"
    )
    monkeypatch.setenv("SUPABASE_LOCAL_JWT_SECRET", "local-dev-secret-value")

    verifier = get_auth_verifier()

    assert isinstance(verifier, SupabaseJwtVerifier)
