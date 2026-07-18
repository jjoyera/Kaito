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


def _assert_bounded_equal(actual: object, expected: object, message: str) -> None:
    if actual != expected:
        pytest.fail(message, pytrace=False)


def _snapshot() -> dict:
    return {
        "contract_version": "1",
        "state": "completed",
        "profile": {
            "prior_history": {
                "longest_completed_distance_km": 42.2,
                "habitual_terrain": "mixed",
                "mountain_experience": "medium",
                "prior_modality_race_frequency": "once",
            },
            "baseline_4_weeks": {
                "sessions": 12,
                "distance_km": 75.0,
                "positive_elevation_m": 1200.0,
                "longest_outing_km": 25.0,
                "recent_consistency": "fairly_consistent",
            },
            "availability": {
                "minutes_by_day": {"monday": 45, "wednesday": 75, "saturday": 120}
            },
            "training_preferences": {
                "mountain_trail_access": "easy_access",
                "gym_access": "yes",
                "planning_preference": "fixed_routine",
            },
            "physical_status": {
                "status": "feeling_good",
                "has_pain_or_limitation": False,
            },
        },
        "goal": {
            "modality": "trail",
            "target_date": "2026-08-01",
            "target_distance_km": 50.0,
            "positive_elevation_m": 1800.0,
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
        del owner_id
        if self.error:
            raise self.error
        self.stored = {
            "contract_version": snapshot.contract_version,
            "state": snapshot.state.value,
            "profile": dict(snapshot.profile),
            "goal": dict(snapshot.goal),
        }


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
    _assert_bounded_equal(
        response.json(),
        {"snapshot": snapshot, "diagnostics": []},
        "onboarding response mismatch",
    )


def test_put_retry_and_get_keep_one_exact_current_availability_snapshot(
    client: TestClient,
) -> None:
    snapshot = _snapshot()
    for _ in range(2):
        response = client.put(
            "/runner-profile/onboarding",
            headers=_auth_headers(),
            json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
        )
        assert response.status_code == 200
    response = client.get(
        f"/runner-profile/onboarding?validation_date={_VALIDATION_DATE}",
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    minutes_by_day = response.json()["snapshot"]["profile"]["availability"][
        "minutes_by_day"
    ]
    _assert_bounded_equal(
        minutes_by_day,
        {"monday": 45, "wednesday": 75, "saturday": 120},
        "availability round-trip mismatch",
    )
    assert client.app.state.onboarding_transactions.calls == 3


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


@pytest.mark.parametrize(
    ("block", "field", "value"),
    [
        ("prior_history", "training_years", None),
        ("prior_history", "completed_race_count_range", "one_to_three"),
        ("prior_history", "practiced_modalities", ["trail"]),
        ("prior_history", "practiced_terrain", ["mountain"]),
        ("goal", "technicality", "high"),
    ],
)
def test_put_rejects_removed_field_with_bounded_response_before_persistence(
    client: TestClient, block: str, field: str, value: object
) -> None:
    snapshot = _snapshot()
    target = snapshot["goal"] if block == "goal" else snapshot["profile"][block]
    target[field] = value
    transactions = client.app.state.onboarding_transactions

    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid onboarding snapshot"}
    assert field not in response.text
    _assert_bounded_equal(_OWNER_ID in response.text, False, "owner disclosure")
    assert transactions.calls == 0


@pytest.mark.parametrize(
    "minutes_by_day",
    [{"monday": None}, {"holiday": 60}],
)
def test_put_rejects_invalid_availability_with_bounded_422(
    client: TestClient, minutes_by_day: dict[str, int | None]
) -> None:
    snapshot = _snapshot()
    snapshot["profile"]["availability"]["minutes_by_day"] = minutes_by_day
    transactions = client.app.state.onboarding_transactions

    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid onboarding snapshot"}
    assert "holiday" not in response.text
    _assert_bounded_equal(_OWNER_ID in response.text, False, "owner disclosure")
    assert transactions.calls == 0


def test_put_normalizes_and_returns_physical_status_detail(client: TestClient) -> None:
    snapshot = _snapshot()
    snapshot["profile"]["physical_status"] = {
        "status": "recovering",
        "has_pain_or_limitation": True,
        "pain_or_limitation_affects_running": True,
        "pain_or_limitation_detail": "  Tobillo izquierdo\n  al bajar  ",
    }

    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
    )

    assert response.status_code == 200
    assert response.json()["snapshot"]["profile"]["physical_status"] == {
        "status": "recovering",
        "has_pain_or_limitation": True,
        "pain_or_limitation_affects_running": True,
        "pain_or_limitation_detail": "Tobillo izquierdo\n  al bajar",
    }


def test_put_rejects_overlong_physical_status_detail_with_bounded_422(
    client: TestClient,
) -> None:
    snapshot = _snapshot()
    snapshot["profile"]["physical_status"]["pain_or_limitation_detail"] = "x" * 501
    transactions = client.app.state.onboarding_transactions

    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid onboarding snapshot"}
    assert transactions.calls == 0


def test_put_demotes_invalid_training_preference_with_bounded_diagnostic(
    client: TestClient,
) -> None:
    snapshot = _snapshot()
    snapshot["profile"]["training_preferences"]["gym_access"] = "no"

    response = client.put(
        "/runner-profile/onboarding",
        headers=_auth_headers(),
        json={"snapshot": snapshot, "validation_date": _VALIDATION_DATE},
    )

    assert response.status_code == 200
    assert response.json()["snapshot"]["state"] == "incomplete"
    assert response.json()["diagnostics"] == [
        {
            "code": "out_of_range",
            "field": "profile.training_preferences.gym_access",
            "message_key": "out_of_range",
            "severity": "error",
            "metadata": {},
        }
    ]


def test_get_reads_a_snapshot_for_the_explicit_validation_date(
    client: TestClient,
) -> None:
    snapshot = _snapshot()
    response = client.get(
        f"/runner-profile/onboarding?validation_date={_VALIDATION_DATE}",
        headers=_auth_headers(),
    )

    assert response.status_code == 200
    _assert_bounded_equal(
        response.json(),
        {"snapshot": snapshot, "diagnostics": []},
        "onboarding response mismatch",
    )


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
    _assert_bounded_equal(_OWNER_ID in response.text, False, "owner disclosure")
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
    _assert_bounded_equal(_OWNER_ID in response.text, False, "owner disclosure")
    assert "owner" not in response.text.lower()
    assert "storage" not in response.text.lower()
    assert response.status_code == 503
    assert response.json() == {"detail": "Service unavailable"}
