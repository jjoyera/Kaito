from contextlib import contextmanager
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from app.modules.planning.router import get_trusted_utc_date, router
from app.modules.planning.use_cases import DraftPlanConflict
from tests.planning.test_approach_eligibility import eligible_snapshot


class Repository:
    def __init__(self, snapshot=None, error=None):
        self.snapshot = eligible_snapshot() if snapshot is None else snapshot
        self.error = error
        self.saved = None

    def read_onboarding(self, owner_id):
        assert owner_id.value == "verified-runner"
        if self.error:
            raise self.error
        return self.snapshot

    def save_draft(self, owner_id, approach):
        assert owner_id.value == "verified-runner"
        if self.error:
            raise self.error
        self.saved = approach
        return {
            "plan_id": "9dd180d0-058d-4ee5-b8cf-3e93867a4041",
            "status": "draft",
            "plan_approach": approach,
            "owner_id": "must-not-leak",
        }


class Transactions:
    def __init__(self, repository):
        self.repository = repository

    @contextmanager
    def __call__(self, user):
        assert user.user_id == "verified-runner"
        yield self.repository


class ProductionWrappingTransactions(Transactions):
    @contextmanager
    def __call__(self, user):
        assert user.user_id == "verified-runner"
        try:
            yield self.repository
        except Exception:
            raise RuntimeError("database_unavailable") from None


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: UserContext("verified-runner")
    app.dependency_overrides[get_trusted_utc_date] = lambda: date(2026, 7, 1)
    repository = Repository()
    app.state.training_plan_transactions = Transactions(repository)
    return TestClient(app, raise_server_exceptions=False), repository


def test_put_returns_bounded_draft_without_owner_leak(client):
    api, repository = client
    response = api.put(
        "/planning/training-plan-draft", json={"plan_approach": "mode_z"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "plan_id": "9dd180d0-058d-4ee5-b8cf-3e93867a4041",
        "status": "draft",
        "plan_approach": "mode_z",
    }
    assert repository.saved == "mode_z"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"plan_approach": "z_mode"},
        {"plan_approach": "mode_z", "owner_id": "foreign"},
    ],
)
def test_put_rejects_malformed_or_noncanonical_input(client, payload):
    api, repository = client
    response = api.put("/planning/training-plan-draft", json=payload)
    assert response.status_code == 422
    assert repository.saved is None


@pytest.mark.parametrize(
    ("stored", "repository_error", "approach", "expected_status", "detail"),
    [
        (False, None, "kaio_path", 404, "Onboarding snapshot not found"),
        ("incomplete", None, "kaio_path", 409, "Onboarding is incomplete"),
        ("unsupported", None, "kaio_path", 422, "unsupported_modality"),
        ("blocked", None, "mode_z", 409, "blocked_approach"),
        (True, DraftPlanConflict(), "mode_z", 409, "draft_plan_conflict"),
    ],
)
def test_expected_outcomes_exit_wrapping_owner_transaction_before_http_mapping(
    client, stored, repository_error, approach, expected_status, detail
):
    api, _ = client
    if stored is False:
        snapshot = False
    else:
        snapshot = eligible_snapshot()
        if stored == "incomplete":
            snapshot["state"] = "incomplete"
        elif stored == "unsupported":
            snapshot["goal"]["modality"] = "ocr"
            snapshot["goal"]["obstacle_count"] = 10
        elif stored == "blocked":
            snapshot["profile"]["physical_status"]["status"] = "recovering"

    class OutcomeRepository(Repository):
        def read_onboarding(self, owner_id):
            assert owner_id.value == "verified-runner"
            return None if snapshot is False else snapshot

    repository = OutcomeRepository(snapshot=snapshot, error=repository_error)
    api.app.state.training_plan_transactions = ProductionWrappingTransactions(
        repository
    )
    response = api.put(
        "/planning/training-plan-draft", json={"plan_approach": approach}
    )

    assert response.status_code == expected_status
    assert response.json() == {"detail": detail}


def test_put_maps_blocked_conflict_and_unavailable_without_details(client):
    api, _ = client
    blocked = eligible_snapshot()
    blocked["profile"]["physical_status"]["status"] = "recovering"
    api.app.state.training_plan_transactions = Transactions(Repository(blocked))
    blocked_response = api.put(
        "/planning/training-plan-draft", json={"plan_approach": "mode_z"}
    )
    assert blocked_response.json() == {"detail": "blocked_approach"}

    class SaveConflictRepository(Repository):
        def save_draft(self, owner_id, approach):
            del owner_id, approach
            raise DraftPlanConflict()

    api.app.state.training_plan_transactions = Transactions(
        SaveConflictRepository()
    )
    conflict = api.put(
        "/planning/training-plan-draft", json={"plan_approach": "mode_z"}
    )
    assert conflict.status_code == 409
    assert conflict.json() == {"detail": "draft_plan_conflict"}

    api.app.state.training_plan_transactions = Transactions(
        Repository(error=RuntimeError("secret"))
    )
    unavailable = api.put(
        "/planning/training-plan-draft", json={"plan_approach": "mode_z"}
    )
    assert unavailable.status_code == 503
    assert unavailable.json() == {"detail": "Service unavailable"}
    assert "secret" not in unavailable.text
