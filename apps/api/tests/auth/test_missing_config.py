"""
Tests for missing-auth-config behavior (explicit SUPABASE_JWKS_URL version).

Validates:
- App imports successfully with SUPABASE_JWKS_URL (and SUPABASE_URL) unset.
- GET /health still returns 200 {"status": "ok"} without auth config.
- GET /auth/me returns 503 {"detail": "Authentication is not configured"} without
  SUPABASE_JWKS_URL set — including when SUPABASE_URL is present but SUPABASE_JWKS_URL
  is absent.
- No secret/provider material in the 503 response body.
- AuthSettings has jwks_url (read from SUPABASE_JWKS_URL) and optional supabase_url.
- SUPABASE_JWT_SECRET and SUPABASE_SECRET_KEY are not referenced in config.
"""

import importlib
import inspect
import logging

import pytest
from fastapi.testclient import TestClient

from tests.auth.conftest import reloaded_main_test_client

_AUTH_CONFIG_DETAIL = " ".join(["Authentication", "is", "not", "configured"])


# ---------------------------------------------------------------------------
# Config structure assertions (make the RED phase fail clearly on HS256 impl)
# ---------------------------------------------------------------------------


def test_config_module_has_no_jwt_secret_reference() -> None:
    """config.py must not reference SUPABASE_JWT_SECRET at all."""
    from app.core import config as config_module

    source = inspect.getsource(config_module)
    assert (
        "SUPABASE_JWT_SECRET" not in source
    ), "config.py still references SUPABASE_JWT_SECRET — must be removed for JWKS"


def test_auth_settings_has_supabase_url_not_jwt_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AuthSettings must expose supabase_url, not jwt_secret."""
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    from app.core.config import get_auth_settings

    settings = get_auth_settings()
    assert hasattr(
        settings, "supabase_url"
    ), "AuthSettings must have supabase_url attribute"
    assert not hasattr(
        settings, "jwt_secret"
    ), "AuthSettings must not have jwt_secret attribute — SUPABASE_JWT_SECRET removed"


def test_auth_settings_reads_explicit_jwks_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """get_auth_settings must read jwks_url from SUPABASE_JWKS_URL, not derive it."""
    _explicit_url = "https://example.supabase.co/auth/v1/.well-known/jwks.json"
    monkeypatch.setenv("SUPABASE_JWKS_URL", _explicit_url)
    monkeypatch.delenv("SUPABASE_URL", raising=False)  # must not be required
    from app.core.config import get_auth_settings

    settings = get_auth_settings()
    assert hasattr(settings, "jwks_url"), "AuthSettings must have jwks_url attribute"
    assert getattr(settings, "jwks_url") == _explicit_url, (
        "AuthSettings.jwks_url must equal SUPABASE_JWKS_URL exactly; "
        f"got {settings.jwks_url!r}"
    )


def test_config_module_has_no_secret_key_reference() -> None:
    """config.py must not reference SUPABASE_SECRET_KEY."""
    from app.core import config as config_module

    source = inspect.getsource(config_module)
    assert "SUPABASE_SECRET_KEY" not in source, (
        "config.py must not reference SUPABASE_SECRET_KEY "
        "— it is not used for JWT verification"
    )


def test_jwks_cache_ttl_uses_default_for_invalid_zero_or_negative(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Invalid, zero, or negative JWKS cache TTL uses the safe default."""
    from app.core import config as config_module
    from app.core.config import get_auth_settings

    default_ttl = getattr(config_module, "DEFAULT_JWKS_CACHE_TTL_SECONDS")
    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.test/jwks.json")

    monkeypatch.setenv("SUPABASE_JWKS_CACHE_TTL_SECONDS", "abc")
    invalid_settings = get_auth_settings()

    monkeypatch.setenv("SUPABASE_JWKS_CACHE_TTL_SECONDS", "0")
    zero_settings = get_auth_settings()

    monkeypatch.setenv("SUPABASE_JWKS_CACHE_TTL_SECONDS", "-10")
    negative_settings = get_auth_settings()

    assert invalid_settings.jwks_cache_ttl_seconds == default_ttl
    assert zero_settings.jwks_cache_ttl_seconds == default_ttl
    assert negative_settings.jwks_cache_ttl_seconds == default_ttl


def test_jwks_cache_ttl_accepts_positive_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Positive JWKS cache TTL values are preserved for PyJWKClient lifespan."""
    from app.core.config import get_auth_settings

    monkeypatch.setenv("SUPABASE_JWKS_URL", "https://example.test/jwks.json")
    monkeypatch.setenv("SUPABASE_JWKS_CACHE_TTL_SECONDS", "42")

    assert get_auth_settings().jwks_cache_ttl_seconds == 42


# ---------------------------------------------------------------------------
# Fixture: TestClient with SUPABASE_URL absent
# ---------------------------------------------------------------------------


@pytest.fixture()
def no_auth_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """TestClient against a freshly reloaded app with auth config absent."""
    return reloaded_main_test_client(
        monkeypatch,
        jwks_url=None,
        audience=None,
    )


@pytest.fixture()
def url_only_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """TestClient with SUPABASE_URL set but SUPABASE_JWKS_URL absent.

    Proves that SUPABASE_URL alone is not sufficient to enable auth; the explicit
    SUPABASE_JWKS_URL is required for protected routes to work.
    """
    return reloaded_main_test_client(
        monkeypatch,
        jwks_url=None,
        supabase_url="https://example.supabase.co",
    )


# ---------------------------------------------------------------------------
# App import succeeds without config
# ---------------------------------------------------------------------------


def test_app_imports_successfully_without_auth_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """from app.main import app must succeed with auth env vars unset.

    Both SUPABASE_JWKS_URL and SUPABASE_URL may be absent; neither may be
    required at import time or module-level execution.
    """
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    import app.main as main_module

    importlib.reload(main_module)
    assert main_module.app.title == "Kaito API"


# ---------------------------------------------------------------------------
# Public routes work without config
# ---------------------------------------------------------------------------


def test_health_returns_200_without_auth_config(no_auth_client: TestClient) -> None:
    """GET /health must return 200 even when SUPABASE_URL is absent."""
    response = no_auth_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Protected routes fail clearly with 503
# ---------------------------------------------------------------------------


def test_auth_me_returns_503_without_auth_config(no_auth_client: TestClient) -> None:
    """GET /auth/me must return 503 when SUPABASE_JWKS_URL is absent."""
    response = no_auth_client.get("/auth/me")
    assert response.status_code == 503


def test_missing_auth_config_is_logged_without_sensitive_material(
    no_auth_client: TestClient,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Missing auth config emits an operational log without secrets/provider URLs."""
    caplog.set_level(logging.ERROR, logger="app.core.auth.provider")

    response = no_auth_client.get("/auth/me")

    assert response.status_code == 503
    messages = [record.getMessage() for record in caplog.records]
    expected_message = " ".join(
        ["Authentication", "verifier", "is", "not", "configured"]
    )
    assert any(expected_message in msg for msg in messages)
    joined_messages = " ".join(messages).lower()
    assert "secret" not in joined_messages
    assert "token" not in joined_messages
    assert "supabase" not in joined_messages


def test_auth_me_returns_503_with_url_but_no_jwks_url(
    url_only_client: TestClient,
) -> None:
    """GET /auth/me must return 503 when SUPABASE_URL set but SUPABASE_JWKS_URL absent.

    SUPABASE_URL alone is not sufficient; explicit SUPABASE_JWKS_URL is required.
    """
    response = url_only_client.get("/auth/me")
    assert response.status_code == 503


def test_auth_me_503_body_is_exact(no_auth_client: TestClient) -> None:
    """503 body must be exactly {'detail': 'Authentication is not configured'}."""
    response = no_auth_client.get("/auth/me")
    assert response.json() == {"detail": _AUTH_CONFIG_DETAIL}


def test_auth_me_503_body_has_no_secret_material(no_auth_client: TestClient) -> None:
    """503 body must not contain secret material or provider internals."""
    response = no_auth_client.get("/auth/me")
    body_str = response.text.lower()
    forbidden_substrings = ["secret", "jwt_secret", "supabase_jwt"]
    for substr in forbidden_substrings:
        assert (
            substr not in body_str
        ), f"Forbidden string '{substr}' found in 503 body: {response.text!r}"
