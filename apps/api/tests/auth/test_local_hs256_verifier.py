"""
Tests for the local-development HS256 JWT verifier adapter.

This adapter exists ONLY for local Supabase CLI development, where the
GoTrue container signs tokens with a shared HS256 secret instead of
publishing asymmetric JWKS. It must never be reachable when SUPABASE_JWKS_URL
is configured (see test_provider_local_hs256_selection.py for that guard).
"""

import jwt
import pytest

from app.core.auth.local_hs256 import LocalHs256JwtVerifier
from app.core.config import AuthSettings
from app.modules.auth.verifier import AuthError

_SECRET = "local-dev-shared-secret-at-least-32-chars-long"
_USER_ID = "b1c2d3e4-f5a6-7890-abcd-ef1234567890"
_EMAIL = "runner@example.com"
_AUDIENCE = "authenticated"
_FUTURE_EXP = 4_102_444_800


def _settings(**overrides) -> AuthSettings:
    base = {
        "jwks_url": "",
        "local_jwt_secret": _SECRET,
        "jwt_audience": _AUDIENCE,
        "jwt_issuer": None,
    }
    base.update(overrides)
    return AuthSettings(**base)


def _token(secret: str = _SECRET, algorithm: str = "HS256", **claims) -> str:
    payload = {"sub": _USER_ID, "email": _EMAIL, "aud": _AUDIENCE, "exp": _FUTURE_EXP}
    payload.update(claims)
    return jwt.encode(payload, secret, algorithm=algorithm)


def test_verifies_a_valid_hs256_token():
    verifier = LocalHs256JwtVerifier(_settings())
    context = verifier.verify(_token())
    assert context.user_id == _USER_ID
    assert context.email == _EMAIL


def test_rejects_a_token_signed_with_the_wrong_secret():
    verifier = LocalHs256JwtVerifier(_settings())
    wrong_signing_key = f"{_SECRET}-alternate"
    token = _token(secret=wrong_signing_key)
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_rejects_a_token_missing_subject():
    verifier = LocalHs256JwtVerifier(_settings())
    payload = {"email": _EMAIL, "aud": _AUDIENCE, "exp": _FUTURE_EXP}
    token = jwt.encode(payload, _SECRET, algorithm="HS256")
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_rejects_an_expired_token():
    verifier = LocalHs256JwtVerifier(_settings())
    token = _token(exp=1_000_000_000)
    with pytest.raises(AuthError):
        verifier.verify(token)


def test_allows_missing_email():
    verifier = LocalHs256JwtVerifier(_settings())
    payload = {"sub": _USER_ID, "aud": _AUDIENCE, "exp": _FUTURE_EXP}
    token = jwt.encode(payload, _SECRET, algorithm="HS256")
    context = verifier.verify(token)
    assert context.user_id == _USER_ID
    assert context.email is None
