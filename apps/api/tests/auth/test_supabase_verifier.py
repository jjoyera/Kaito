"""
Tests for the Supabase JWT verifier adapter (JWKS / asymmetric version).

Uses an ephemeral EC P-256 / ES256 keypair for signing. The JWKS HTTP fetch
is stubbed via monkeypatch on PyJWKClient.fetch_data so no network calls are
made. Env vars are set via monkeypatch so settings are read at call time.
"""

import json
import logging

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from jwt.algorithms import ECAlgorithm

from app.core.auth.supabase import SupabaseJwtVerifier
from app.core.config import AuthSettings
from app.modules.auth.verifier import AuthError

# ---------------------------------------------------------------------------
# Module-level ephemeral keypair (generated once per test session)
# ---------------------------------------------------------------------------

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_PUBLIC_KEY = _PRIVATE_KEY.public_key()
_TEST_KID = "test-kid-1"
_ALT_KID = "unknown-kid-99"  # a kid not in our fake JWKS

_USER_ID = "b1c2d3e4-f5a6-7890-abcd-ef1234567890"
_EMAIL = "runner@example.com"
_TEST_AUDIENCE = "authenticated"
_BASE_IAT = 1_735_689_600
_FUTURE_EXP = 4_102_444_800


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _make_jwks() -> dict:
    """Build a minimal JWKS dict from the module-level public key."""
    try:
        jwk = json.loads(ECAlgorithm.to_jwk(_PUBLIC_KEY))
    except (TypeError, ValueError) as exc:
        pytest.fail(f"failed to build test JWKS: {exc}")
    jwk["kid"] = _TEST_KID
    jwk["alg"] = "ES256"
    jwk["use"] = "sig"
    return {"keys": [jwk]}


def _make_settings(
    audience: str | None = _TEST_AUDIENCE,
    issuer: str | None = None,
) -> AuthSettings:
    return AuthSettings(
        jwks_url="https://example.supabase.co/auth/v1/.well-known/jwks.json",
        jwt_audience=audience,
        jwt_issuer=issuer,
    )


def _make_token(
    sub: str | None = _USER_ID,
    email: str | None = _EMAIL,
    audience: str | None = _TEST_AUDIENCE,
    exp: int = _FUTURE_EXP,
    kid: str = _TEST_KID,
    algorithm: str = "ES256",
    signing_key=None,  # defaults to _PRIVATE_KEY
) -> str:
    """Sign an ES256 token with the test private key and optional kid header."""
    key = signing_key if signing_key is not None else _PRIVATE_KEY
    payload: dict = {"iat": _BASE_IAT, "exp": exp}
    if sub is not None:
        payload["sub"] = sub
    if email is not None:
        payload["email"] = email
    if audience is not None:
        payload["aud"] = audience
    headers = {"kid": kid} if kid else {}
    return jwt.encode(payload, key, algorithm=algorithm, headers=headers)


# ---------------------------------------------------------------------------
# Fixture: stub JWKS fetch so tests never hit the network
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def stub_jwks_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch PyJWKClient.fetch_data to return the in-process fake JWKS."""
    fake = _make_jwks()
    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", lambda self: fake)


# ---------------------------------------------------------------------------
# Success cases
# ---------------------------------------------------------------------------


def test_valid_token_returns_user_context_with_user_id_and_email() -> None:
    """Valid ES256 token with sub and email yields UserContext with both fields."""
    verifier = SupabaseJwtVerifier(_make_settings())
    token = _make_token()
    ctx = verifier.verify(token)
    assert ctx.user_id == _USER_ID
    assert ctx.email == _EMAIL


def test_valid_token_without_email_returns_user_context_with_none_email() -> None:
    """Valid token with sub but no email yields UserContext.email == None."""
    verifier = SupabaseJwtVerifier(_make_settings())
    token = _make_token(email=None)
    ctx = verifier.verify(token)
    assert ctx.user_id == _USER_ID
    assert ctx.email is None


# ---------------------------------------------------------------------------
# Failure cases — AuthError expected
# ---------------------------------------------------------------------------


def test_missing_sub_claim_raises_auth_error() -> None:
    """Token with no 'sub' claim raises AuthError (no user_id derivable)."""
    verifier = SupabaseJwtVerifier(_make_settings())
    token = _make_token(sub=None)
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_empty_sub_claim_raises_auth_error() -> None:
    """Token with empty 'sub' raises AuthError."""
    verifier = SupabaseJwtVerifier(_make_settings())
    token = _make_token(sub="")
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_expired_token_raises_auth_error() -> None:
    """Expired token (exp=1) raises AuthError."""
    verifier = SupabaseJwtVerifier(_make_settings())
    token = _make_token(exp=1)
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_bad_signature_raises_auth_error() -> None:
    """Token signed by a different EC key raises AuthError (bad signature)."""
    verifier = SupabaseJwtVerifier(_make_settings())
    other_key = ec.generate_private_key(ec.SECP256R1())
    token = _make_token(signing_key=other_key)
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_unknown_kid_raises_auth_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """Token with kid not present in JWKS raises AuthError."""
    verifier = SupabaseJwtVerifier(_make_settings())
    # Sign with the right key but use an unknown kid so JWKS lookup fails.
    token = _make_token(kid=_ALT_KID)
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_alg_none_token_raises_auth_error() -> None:
    """Token declaring alg 'none' raises AuthError (algorithm confusion prevention)."""
    verifier = SupabaseJwtVerifier(_make_settings())
    # Encode with alg=none: PyJWT encodes an unsecured token.
    payload = {
        "sub": _USER_ID,
        "aud": _TEST_AUDIENCE,
        "iat": _BASE_IAT,
        "exp": _FUTURE_EXP,
    }
    # PyJWT rejects encoding with algorithm="none" — use raw header manipulation.
    import base64

    none_header = b'{"alg":"none","typ":"JWT"}'
    header = base64.urlsafe_b64encode(none_header).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    token = f"{header}.{body}."
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_hs256_token_raises_auth_error() -> None:
    """Token declaring HS256 alg raises AuthError (asymmetric-only policy)."""
    verifier = SupabaseJwtVerifier(_make_settings())
    hs_token = jwt.encode(
        {"sub": _USER_ID, "aud": _TEST_AUDIENCE, "iat": _BASE_IAT, "exp": _FUTURE_EXP},
        "some-secret",
        algorithm="HS256",
        headers={"kid": _TEST_KID},
    )
    with pytest.raises(AuthError):
        verifier.verify(hs_token)


def test_malformed_token_raises_auth_error() -> None:
    """Garbage string raises AuthError (malformed JWT)."""
    verifier = SupabaseJwtVerifier(_make_settings())
    with pytest.raises(AuthError):
        verifier.verify("not.a.jwt")


def test_verifier_failure_is_logged_without_sensitive_material(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Verifier failures emit generic operational logs without token/JWKS material."""
    verifier = SupabaseJwtVerifier(_make_settings())
    caplog.set_level(logging.WARNING, logger="app.core.auth.supabase")

    with pytest.raises(AuthError):
        verifier.verify("not.a.jwt")

    messages = [record.getMessage() for record in caplog.records]
    assert any("JWT verification failed" in msg for msg in messages)
    joined_messages = " ".join(messages).lower()
    assert "not.a.jwt" not in joined_messages
    assert "example.supabase.co" not in joined_messages
    assert "secret" not in joined_messages


def test_wrong_audience_raises_auth_error() -> None:
    """Token with wrong audience raises AuthError when audience check is on."""
    verifier = SupabaseJwtVerifier(_make_settings(audience=_TEST_AUDIENCE))
    token = _make_token(audience="wrong-audience")
    with pytest.raises(AuthError):
        verifier.verify(token)
