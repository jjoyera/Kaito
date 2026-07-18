from contextlib import contextmanager
from copy import deepcopy
from datetime import date
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from app.modules.planning.router import get_trusted_utc_date, router
from tests.planning.test_approach_eligibility import eligible_snapshot


class Repository:
    def __init__(self, stored=None, error=None):
        self.stored = stored
        self.error = error
        self.read_owner = None
        self.upsert_calls = 0

    def read(self, owner_id):
        self.read_owner = owner_id.value
        if self.error:
            raise self.error
        return self.stored

    def upsert(self, owner_id, snapshot):
        self.upsert_calls += 1
        del owner_id, snapshot
        if self.error:
            raise self.error


class Transactions:
    def __init__(self, repository):
        self.repository = repository

    @contextmanager
    def __call__(self, user):
        assert user.user_id == "verified-runner"
        yield self.repository


@pytest.fixture
def app_client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: UserContext("verified-runner")
    app.dependency_overrides[get_trusted_utc_date] = lambda: date(2026, 7, 1)
    repository = Repository(eligible_snapshot())
    app.state.onboarding_transactions = Transactions(repository)
    return TestClient(app, raise_server_exceptions=False), repository


def test_endpoint_is_protected_and_uses_verified_owner(app_client):
    client, repository = app_client
    app = client.app
    app.dependency_overrides[get_current_user] = lambda: (_ for _ in ()).throw(
        HTTPException(401, "Not authenticated")
    )
    response = client.get(
        "/planning/training-approach-eligibility?assessment_date=2026-07-01"
    )
    assert response.status_code == 401

    app.dependency_overrides[get_current_user] = lambda: UserContext("verified-runner")
    response = client.get(
        "/planning/training-approach-eligibility?assessment_date=2026-07-01"
    )
    assert response.status_code == 200
    assert repository.read_owner == "verified-runner"
    assert response.json()["recommended_approach"] == "mode_z"
    assert repository.upsert_calls == 0
    assert [item["approach"] for item in response.json()["approaches"]] == [
        "kaio_path",
        "mode_z",
        "kaioken",
    ]


@pytest.mark.parametrize(
    ("stored", "error", "status_code", "detail"),
    [
        (None, None, 404, "Onboarding snapshot not found"),
        ({"contract_version": "2"}, None, 500, "Stored onboarding snapshot is invalid"),
        (None, RuntimeError("secret"), 503, "Service unavailable"),
    ],
)
def test_endpoint_maps_persistence_outcomes(
    app_client, stored, error, status_code, detail
):
    client, _ = app_client
    repository = Repository(stored, error)
    client.app.state.onboarding_transactions = Transactions(repository)
    with patch("app.modules.planning.router.sentry_sdk.capture_exception") as capture:
        response = client.get(
            "/planning/training-approach-eligibility?assessment_date=2026-07-01"
        )
    assert response.status_code == status_code
    assert response.json() == {"detail": detail}
    assert "secret" not in response.text
    assert repository.upsert_calls == 0
    assert capture.call_count == (1 if status_code in {500, 503} else 0)


def test_endpoint_maps_incomplete_and_unsupported_modality(app_client):
    client, _ = app_client
    incomplete = eligible_snapshot()
    incomplete["state"] = "incomplete"
    client.app.state.onboarding_transactions = Transactions(Repository(incomplete))
    response = client.get(
        "/planning/training-approach-eligibility?assessment_date=2026-07-01"
    )
    assert response.status_code == 409
    assert client.app.state.onboarding_transactions.repository.upsert_calls == 0

    legacy = eligible_snapshot()
    legacy["profile"]["prior_history"].pop("habitual_terrain")
    legacy_repository = Repository(legacy)
    client.app.state.onboarding_transactions = Transactions(legacy_repository)
    response = client.get(
        "/planning/training-approach-eligibility?assessment_date=2026-07-01"
    )
    assert response.status_code == 409
    assert legacy_repository.upsert_calls == 0

    unsupported = deepcopy(eligible_snapshot())
    unsupported["goal"]["modality"] = "ocr"
    unsupported["goal"]["obstacle_count"] = 10
    client.app.state.onboarding_transactions = Transactions(Repository(unsupported))
    response = client.get(
        "/planning/training-approach-eligibility?assessment_date=2026-07-01"
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "unsupported_modality"}

    unsupported["goal"]["target_date"] = "2026-06-01"
    unsupported["profile"]["physical_status"].pop("has_pain_or_limitation")
    unsupported_repository = Repository(unsupported)
    client.app.state.onboarding_transactions = Transactions(unsupported_repository)
    response = client.get(
        "/planning/training-approach-eligibility?assessment_date=2026-07-01"
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "unsupported_modality"}
    assert unsupported_repository.upsert_calls == 0


def test_assessment_date_must_equal_trusted_utc_date(app_client):
    client, repository = app_client
    repository.stored["goal"]["target_date"] = "2026-08-25"

    response = client.get(
        "/planning/training-approach-eligibility?assessment_date=2026-07-01"
    )
    assert response.status_code == 200
    mode_z = next(
        item for item in response.json()["approaches"] if item["approach"] == "mode_z"
    )
    assert not mode_z["available"]

    for rejected in ("2026-06-30", "2026-07-02"):
        response = client.get(
            f"/planning/training-approach-eligibility?assessment_date={rejected}"
        )
        assert response.status_code == 422
        assert response.json() == {"detail": "assessment_date_out_of_range"}
