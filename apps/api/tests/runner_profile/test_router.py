"""Behavior-first HTTP contracts for protected onboarding persistence routes."""

import json
from contextlib import contextmanager

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jwt.algorithms import ECAlgorithm

from app.modules.auth.context import UserContext
from app.modules.runner_profile.router import router
from tests.auth.conftest import configure_auth_test_env

_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
_PUBLIC_KEY = _PRIVATE_KEY.public_key()
_TEST_AUDIENCE = "authenticated"
_TEST_KID = "runner-profile-router"
_OWNER_ID = "b1c2d3e4-f5a6-7890-abcd-ef1234567890"
_FUTURE_EXP = 4_102_444_800
_VALIDATION_DATE = "2026-07-13"


def _make_jwks() -> dict:
    jwk = json.loads(ECAlgorithm.to_jwk(_PUBLIC_KEY))
    jwk.update({"kid": _TEST_KID, "alg": "ES256", "use": "sig"})
    return {"keys": [jwk]}


def _auth_headers() -> dict[str, str]:
    token = jwt.encode(
        {
            "sub": _OWNER_ID,
            "aud": _TEST_AUDIENCE,
            "iat": 1_735_689_600,
            "exp": _FUTURE_EXP,
        },
        _PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": _TEST_KID},
    )
    return {"Authorization": f"Bearer {token}"}


def _snapshot() -> dict:
    return {
        "contract_version": "1",
        "state": "completed",
        "profile": {
            "prior_history": {
                "training_years": 1.5,
                "completed_race_count_range": "one_to_three",
                "longest_completed_distance_km": 42.2,
                "practiced_modalities": ["trail"],
                "practiced_terrain": ["mountain"],
            },
            "baseline_4_weeks": {
                "sessions": 12,
                "training_hours": 8.5,
                "distance_km": 75.0,
                "positive_elevation_m": 1200.0,
                "longest_outing_km": 25.0,
            },
            "availability": {
                "minutes_by_day": {"monday": 60, "wednesday": 60, "saturday": 90}
            },
            "restrictions": {"has_restrictions": False},
        },
        "goal": {
            "modality": "trail",
            "target_date": "2026-08-01",
            "target_distance_km": 50.0,
            "positive_elevation_m": 1800.0,
            "technicality": "high",
        },
    }


class _Repository:
    def __init__(
        self, stored: dict | None = None, error: Exception | None = None
    ) -> None:
        self.stored = stored
        self.error = error

    def read(self, owner_id) -> dict | None:
        del owner_id
        if self.error:
            raise self.error
        return self.stored

    def upsert(self, owner_id, snapshot) -> None:
        del owner_id, snapshot
        if self.error:
            raise self.error


class _Transactions:
    def __init__(self, repository: _Repository) -> None:
        self.repository = repository
        self.calls = 0

    @contextmanager
    def __call__(self, user: UserContext):
        del user
        self.calls += 1
        yield self.repository


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    configure_auth_test_env(
        monkeypatch,
        audience=_TEST_AUDIENCE,
        fake_jwks=_make_jwks(),
    )
    app = FastAPI()
    app.include_router(router)
    app.state.onboarding_transactions = _Transactions(_Repository(_snapshot()))
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize(
    ("method", "url", "payload"),
    [
        (
            "put",
            "/runner-profile/onboarding",
            {"snapshot": _snapshot(), "validation_date": _VALIDATION_DATE},
        ),
        ("get", f"/runner-profile/onboarding?validation_date={_VALIDATION_DATE}", None),
    ],
)
def test_onboarding_routes_reject_unauthenticated_requests(
    client: TestClient, method: str, url: str, payload: dict | None
) -> None:
    if payload is None:
        response = getattr(client, method)(url)
    else:
        response = getattr(client, method)(url, json=payload)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_put_saves_a_snapshot_and_returns_only_snapshot_and_diagnostics(
    client: TestClient,
) -> None:
    snapshot = _snapshot()
    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
    )

    assert response.status_code == 200
    assert response.json() == {"snapshot": snapshot, "diagnostics": []}


def test_put_maps_malformed_nested_block_to_422_before_persistence(
    client: TestClient,
) -> None:
    snapshot = _snapshot()
    snapshot["profile"]["prior_history"] = []
    transactions = client.app.state.onboarding_transactions

    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid onboarding snapshot"}
    assert transactions.calls == 0


def test_get_reads_a_snapshot_for_the_explicit_validation_date(
    client: TestClient,
) -> None:
    snapshot = _snapshot()
    response = client.get(
        f"/runner-profile/onboarding?validation_date={_VALIDATION_DATE}",
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {"snapshot": snapshot, "diagnostics": []}


@pytest.mark.parametrize("forbidden_field", ["owner_id", "created_at"])
def test_put_rejects_client_owned_or_storage_managed_fields(
    client: TestClient, forbidden_field: str
) -> None:
    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={
            "snapshot": _snapshot(),
            "validation_date": _VALIDATION_DATE,
            forbidden_field: "client-controlled",
        },
    )

    assert response.status_code == 422
    assert forbidden_field in response.text


def test_get_returns_404_when_the_authenticated_owner_has_no_snapshot(
    client: TestClient,
) -> None:
    client.app.state.onboarding_transactions = _Transactions(_Repository())
    response = client.get(
        f"/runner-profile/onboarding?validation_date={_VALIDATION_DATE}",
        headers=_auth_headers(),
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Onboarding snapshot not found"}


def test_get_returns_sanitized_500_for_corrupt_stored_data(client: TestClient) -> None:
    client.app.state.onboarding_transactions = _Transactions(
        _Repository({"contract_version": "2"})
    )
    response = client.get(
        f"/runner-profile/onboarding?validation_date={_VALIDATION_DATE}",
        headers=_auth_headers(),
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "Stored onboarding snapshot is invalid"}
    assert _OWNER_ID not in response.text
    assert "storage" not in response.text.lower()


def test_put_returns_sanitized_503_when_persistence_is_unavailable(
    client: TestClient,
) -> None:
    raw_payload_marker = "RAW_PAYLOAD_MARKER"
    client.app.state.onboarding_transactions = _Transactions(
        _Repository(error=RuntimeError(raw_payload_marker))
    )
    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={
            "snapshot": _snapshot(),
            "validation_date": _VALIDATION_DATE,
        },
    )

    assert raw_payload_marker not in response.text
    assert _OWNER_ID not in response.text
    assert "owner" not in response.text.lower()
    assert "storage" not in response.text.lower()
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable"}
