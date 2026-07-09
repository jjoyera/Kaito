"""Shared auth-test fixtures."""

import importlib
from collections.abc import Generator, Mapping
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def reset_auth_verifier_cache_between_tests() -> Generator[None, None, None]:
    """Keep process-scoped verifier cache from coupling independent auth tests."""
    from app.core.auth.provider import reset_auth_verifier_cache

    reset_auth_verifier_cache()
    yield
    reset_auth_verifier_cache()


def configure_auth_test_env(
    monkeypatch: pytest.MonkeyPatch,
    *,
    jwks_url: str | None = "https://example.supabase.co/auth/v1/.well-known/jwks.json",
    audience: str | None = "authenticated",
    issuer: str | None = None,
    supabase_url: str | None = None,
    fake_jwks: Mapping[str, Any] | None = None,
    fetch_data: Any | None = None,
) -> None:
    """Configure auth env and optional JWKS stubbing for auth tests."""
    if jwks_url is None:
        monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    else:
        monkeypatch.setenv("SUPABASE_JWKS_URL", jwks_url)

    if audience is None:
        monkeypatch.delenv("SUPABASE_JWT_AUDIENCE", raising=False)
    else:
        monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", audience)

    if issuer is None:
        monkeypatch.delenv("SUPABASE_JWT_ISSUER", raising=False)
    else:
        monkeypatch.setenv("SUPABASE_JWT_ISSUER", issuer)

    if supabase_url is None:
        monkeypatch.delenv("SUPABASE_URL", raising=False)
    else:
        monkeypatch.setenv("SUPABASE_URL", supabase_url)

    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    if fetch_data is not None:
        monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", fetch_data)
    elif fake_jwks is not None:
        monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", lambda self: fake_jwks)


def reloaded_main_test_client(
    monkeypatch: pytest.MonkeyPatch,
    *,
    jwks_url: str | None = "https://example.supabase.co/auth/v1/.well-known/jwks.json",
    audience: str | None = "authenticated",
    issuer: str | None = None,
    supabase_url: str | None = None,
    fake_jwks: Mapping[str, Any] | None = None,
    fetch_data: Any | None = None,
) -> TestClient:
    """Reload app.main with auth env/JWKS stubs and return a TestClient."""
    configure_auth_test_env(
        monkeypatch,
        jwks_url=jwks_url,
        audience=audience,
        issuer=issuer,
        supabase_url=supabase_url,
        fake_jwks=fake_jwks,
        fetch_data=fetch_data,
    )

    import app.main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app, raise_server_exceptions=False)
