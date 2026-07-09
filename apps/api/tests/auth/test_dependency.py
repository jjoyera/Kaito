"""
Tests for the get_current_user FastAPI dependency (JWKS / asymmetric version).

Validates that missing, malformed, and invalid tokens all produce the exact
401 {"detail": "Not authenticated"} contract, and that the handler body
does NOT execute when auth fails. Tokens are signed with an ephemeral EC
P-256 key; JWKS fetch is stubbed so no network calls are made.
"""

import json

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from jwt.algorithms import ECAlgorithm

from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from tests.auth.conftest import configure_auth_test_env

# ---------------------------------------------------------------------------
# Module-level ephemeral keypair and JWKS
# ---------------------------------------------------------------------------

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_PUBLIC_KEY = _PRIVATE_KEY.public_key()
_TEST_KID = "test-kid-dep"
_TEST_AUDIENCE = "authenticated"
_USER_ID = "b1c2d3e4-f5a6-7890-abcd-ef1234567890"
_FUTURE_EXP = 4_102_444_800

_EXPECTED_401 = {"detail": "Not authenticated"}


def _make_jwks() -> dict:
    try:
        jwk = json.loads(ECAlgorithm.to_jwk(_PUBLIC_KEY))
    except (TypeError, ValueError) as exc:
        pytest.fail(f"failed to build test JWKS: {exc}")
    jwk["kid"] = _TEST_KID
    jwk["alg"] = "ES256"
    jwk["use"] = "sig"
    return {"keys": [jwk]}


def _make_valid_token() -> str:
    return jwt.encode(
        {
            "sub": _USER_ID,
            "email": "runner@example.com",
            "aud": _TEST_AUDIENCE,
            "iat": 1_735_689_600,
            "exp": _FUTURE_EXP,
        },
        _PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": _TEST_KID},
    )


# ---------------------------------------------------------------------------
# Fixture: isolated test app with a sentinel protected route
# ---------------------------------------------------------------------------


@pytest.fixture()
def protected_app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    """A minimal FastAPI app with a protected sentinel route.

    SUPABASE_JWKS_URL is set so the verifier is available.
    JWKS fetch is stubbed so tests never hit the network.
    The sentinel side-effect list tracks whether the handler body executed.
    """
    configure_auth_test_env(
        monkeypatch,
        audience=_TEST_AUDIENCE,
        fake_jwks=_make_jwks(),
    )

    test_app = FastAPI()
    executed: list[bool] = []

    @test_app.get("/protected-sentinel")
    def _sentinel(user: UserContext = Depends(get_current_user)) -> dict:
        executed.append(True)
        return {"user_id": user.user_id}

    test_app.state.executed = executed
    return test_app


@pytest.fixture()
def client(protected_app: FastAPI) -> TestClient:
    return TestClient(protected_app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# 401 contract: missing Authorization header
# ---------------------------------------------------------------------------


def test_missing_auth_header_returns_401(client: TestClient) -> None:
    """No Authorization header → 401 with exact body."""
    response = client.get("/protected-sentinel")
    assert response.status_code == 401
    assert response.json() == _EXPECTED_401


def test_missing_auth_header_does_not_execute_handler(
    client: TestClient, protected_app: FastAPI
) -> None:
    """Handler body must NOT execute when Authorization header is missing."""
    client.get("/protected-sentinel")
    assert protected_app.state.executed == []


# ---------------------------------------------------------------------------
# 401 contract: malformed scheme / header value
# ---------------------------------------------------------------------------


def test_malformed_scheme_token_returns_401(client: TestClient) -> None:
    """Authorization: Token <val> (wrong scheme) → 401 exact body."""
    response = client.get(
        "/protected-sentinel", headers={"Authorization": "Token somevalue"}
    )
    assert response.status_code == 401
    assert response.json() == _EXPECTED_401


def test_non_bearer_header_returns_401(client: TestClient) -> None:
    """Authorization: abc (no scheme+value format) → 401 exact body."""
    response = client.get("/protected-sentinel", headers={"Authorization": "abc"})
    assert response.status_code == 401
    assert response.json() == _EXPECTED_401


# ---------------------------------------------------------------------------
# 401 contract: invalid token
# ---------------------------------------------------------------------------


def test_invalid_token_returns_401(client: TestClient) -> None:
    """Bearer token signed with a different EC key → 401 exact body."""
    other_key = ec.generate_private_key(ec.SECP256R1())
    bad_token = jwt.encode(
        {"sub": _USER_ID, "aud": _TEST_AUDIENCE, "exp": _FUTURE_EXP},
        other_key,
        algorithm="ES256",
        headers={"kid": _TEST_KID},
    )
    response = client.get(
        "/protected-sentinel", headers={"Authorization": f"Bearer {bad_token}"}
    )
    assert response.status_code == 401
    assert response.json() == _EXPECTED_401


def test_garbage_token_returns_401(client: TestClient) -> None:
    """Bearer garbage-string token → 401 exact body."""
    response = client.get(
        "/protected-sentinel", headers={"Authorization": "Bearer notajwtatall"}
    )
    assert response.status_code == 401
    assert response.json() == _EXPECTED_401


# ---------------------------------------------------------------------------
# Exact body shape contract
# ---------------------------------------------------------------------------


def test_401_body_has_no_extra_keys(client: TestClient) -> None:
    """401 body must have exactly the key 'detail' and no others."""
    response = client.get("/protected-sentinel")
    assert set(response.json().keys()) == {"detail"}


def test_401_detail_value_is_identical_across_cases(
    client: TestClient,
) -> None:
    """The 'detail' string must be identical for all 401 failure cases."""
    cases = [
        client.get("/protected-sentinel"),
        client.get("/protected-sentinel", headers={"Authorization": "Token x"}),
        client.get(
            "/protected-sentinel",
            headers={"Authorization": "Bearer not.a.jwt"},
        ),
    ]
    details = [r.json()["detail"] for r in cases]
    assert len(set(details)) == 1, f"Got differing detail values: {details}"
