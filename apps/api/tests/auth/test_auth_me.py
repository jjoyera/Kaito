"""
Tests for GET /auth/me endpoint contract (JWKS / asymmetric version).

Validates: identity-only 200 response, email nullable, 401 for missing/invalid
tokens, exact response key set {"user_id", "email"}, and absence of provider
fields. Tokens are signed with an ephemeral EC P-256 key; JWKS fetch is
stubbed so no network calls are made.
"""

import json

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt.algorithms import ECAlgorithm

# ---------------------------------------------------------------------------
# Module-level ephemeral keypair and JWKS
# ---------------------------------------------------------------------------

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_PUBLIC_KEY = _PRIVATE_KEY.public_key()
_TEST_KID = "test-kid-me"
_TEST_AUDIENCE = "authenticated"
_USER_ID = "b1c2d3e4-f5a6-7890-abcd-ef1234567890"
_EMAIL = "runner@example.com"
_BASE_IAT = 1_735_689_600
_FUTURE_EXP = 4_102_444_800


def _make_jwks() -> dict:
    try:
        jwk = json.loads(ECAlgorithm.to_jwk(_PUBLIC_KEY))
    except (TypeError, ValueError) as exc:
        pytest.fail(f"failed to build test JWKS: {exc}")
    jwk["kid"] = _TEST_KID
    jwk["alg"] = "ES256"
    jwk["use"] = "sig"
    return {"keys": [jwk]}


def _make_token(
    sub: str = _USER_ID,
    email: str | None = _EMAIL,
    audience: str = _TEST_AUDIENCE,
    exp: int = _FUTURE_EXP,
) -> str:
    payload: dict = {
        "sub": sub,
        "aud": audience,
        "iat": _BASE_IAT,
        "exp": exp,
    }
    if email is not None:
        payload["email"] = email
    return jwt.encode(
        payload, _PRIVATE_KEY, algorithm="ES256", headers={"kid": _TEST_KID}
    )


@pytest.fixture()
def auth_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """TestClient against app.main.app with SUPABASE_JWKS_URL configured.

    JWKS fetch is stubbed so tests never hit the network.
    """
    _jwks_url = "https://example.supabase.co/auth/v1/.well-known/jwks.json"
    monkeypatch.setenv("SUPABASE_JWKS_URL", _jwks_url)
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", _TEST_AUDIENCE)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)  # optional/informational only

    _fake_jwks = _make_jwks()
    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", lambda self: _fake_jwks)

    import importlib

    import app.main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# 200 success cases
# ---------------------------------------------------------------------------


def test_valid_token_returns_200_with_user_id_and_email(
    auth_client: TestClient,
) -> None:
    """Valid token with email → 200, body has user_id and email."""
    token = _make_token()
    response = auth_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == _USER_ID
    assert body["email"] == _EMAIL


def test_valid_token_without_email_returns_200_with_null_email(
    auth_client: TestClient,
) -> None:
    """Valid token with no email → 200, email is null."""
    token = _make_token(email=None)
    response = auth_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == _USER_ID
    assert body["email"] is None


def test_response_keys_are_exactly_user_id_and_email(
    auth_client: TestClient,
) -> None:
    """Response body must contain exactly {'user_id', 'email'} — no extra fields."""
    token = _make_token()
    response = auth_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert set(response.json().keys()) == {"user_id", "email"}


def test_response_has_no_provider_fields(auth_client: TestClient) -> None:
    """Response must not contain provider-specific fields like 'sub' or 'aud'."""
    token = _make_token()
    response = auth_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    body = response.json()
    forbidden = {"sub", "aud", "iat", "exp", "token", "claims", "raw"}
    assert not forbidden.intersection(
        body.keys()
    ), f"Forbidden provider/raw fields found: {forbidden.intersection(body.keys())}"


# ---------------------------------------------------------------------------
# 401 cases
# ---------------------------------------------------------------------------


def test_no_token_returns_401(auth_client: TestClient) -> None:
    """No Authorization header → 401 with exact body."""
    response = auth_client.get("/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_invalid_token_returns_401(auth_client: TestClient) -> None:
    """Token signed with a different key → 401 with exact body."""
    other_key = ec.generate_private_key(ec.SECP256R1())
    bad_token = jwt.encode(
        {"sub": _USER_ID, "aud": _TEST_AUDIENCE, "iat": _BASE_IAT, "exp": _FUTURE_EXP},
        other_key,
        algorithm="ES256",
        headers={"kid": _TEST_KID},
    )
    response = auth_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {bad_token}"}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_repeated_protected_requests_reuse_jwks_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Repeated valid requests with same settings fetch JWKS once within cache TTL."""
    monkeypatch.setenv(
        "SUPABASE_JWKS_URL",
        "https://example.supabase.co/auth/v1/.well-known/jwks.json",
    )
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", _TEST_AUDIENCE)
    monkeypatch.delenv("SUPABASE_URL", raising=False)

    fake_jwks = _make_jwks()
    fetch_count = 0

    def counted_fetch(self: jwt.PyJWKClient) -> dict:
        nonlocal fetch_count
        fetch_count += 1
        return fake_jwks

    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", counted_fetch)

    import importlib

    import app.main as main_module

    importlib.reload(main_module)
    client = TestClient(main_module.app, raise_server_exceptions=False)
    token = _make_token()

    first_response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    second_response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert fetch_count == 1
