from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import Mock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.config import OpenAIConfigError
from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from app.modules.planning.generation_context import (
    GenerationContextSourceNotFound,
    GenerationWindowUnavailable,
)
from app.modules.planning.generation_provider import (
    TrainingGenerationInvalidResponse,
    TrainingGenerationTimeout,
    TrainingGenerationUnavailable,
)
from app.modules.planning.generation_use_case import GeneratedTrainingBlockRejected
from app.modules.planning.router import (
    get_current_instant,
    get_training_block_provider,
    router,
)
from app.modules.planning.use_cases import (
    ActiveTrainingPlan,
    ActiveTrainingWeek,
    BlockedTrainingApproach,
    GeneratedSessionValues,
    IncompleteOnboarding,
    TrainingPlanPersistenceUnavailable,
)
from app.modules.runner_profile.use_cases import CorruptOnboardingData
from tests.planning.test_approach_eligibility import eligible_snapshot
from tests.planning.test_generate_training_block import candidate
from tests.planning.test_training_plan_persistence import (
    Repository as PersistenceRepository,
)
from tests.planning.test_training_plan_persistence import Transactions


def session(*, week: int, order: int, day: int) -> GeneratedSessionValues:
    return GeneratedSessionValues(
        week_number=week,
        session_order=order,
        scheduled_date=date(2026, 7, day),
        session_type="Easy run",
        session_category="run",
        planned_duration_minutes=30,
        planned_distance_kilometers=Decimal("5.00"),
        planned_elevation_meters=25,
        intensity_description="Easy",
        target_rpe_min=2,
        target_rpe_max=3,
        instructions="Keep it easy",
        purpose="Build consistency",
    )


def active_plan() -> ActiveTrainingPlan:
    return ActiveTrainingPlan(
        plan_id="private-plan-id",
        plan_approach="mode_z",
        start_date=date(2026, 7, 6),
        end_date=date(2026, 7, 19),
        block_focus="Durability",
        weeks=(
            ActiveTrainingWeek(
                2,
                (
                    session(week=2, order=2, day=15),
                    session(week=2, order=1, day=13),
                ),
            ),
            ActiveTrainingWeek(1, (session(week=1, order=1, day=6),)),
        ),
    )


EXPECTED_RESPONSE = {
    "plan_approach": "mode_z",
    "start_date": "2026-07-06",
    "end_date": "2026-07-19",
    "block_focus": "Durability",
    "weeks": [
        {
            "week_number": 1,
            "sessions": [
                {
                    "scheduled_date": "2026-07-06",
                    "session_type": "Easy run",
                    "planned_duration_minutes": 30,
                    "planned_distance_kilometers": "5.00",
                    "planned_elevation_meters": 25,
                    "intensity_description": "Easy",
                    "target_rpe_min": 2,
                    "target_rpe_max": 3,
                    "instructions": "Keep it easy",
                    "purpose": "Build consistency",
                }
            ],
        },
        {
            "week_number": 2,
            "sessions": [
                {
                    "scheduled_date": "2026-07-13",
                    "session_type": "Easy run",
                    "planned_duration_minutes": 30,
                    "planned_distance_kilometers": "5.00",
                    "planned_elevation_meters": 25,
                    "intensity_description": "Easy",
                    "target_rpe_min": 2,
                    "target_rpe_max": 3,
                    "instructions": "Keep it easy",
                    "purpose": "Build consistency",
                },
                {
                    "scheduled_date": "2026-07-15",
                    "session_type": "Easy run",
                    "planned_duration_minutes": 30,
                    "planned_distance_kilometers": "5.00",
                    "planned_elevation_meters": 25,
                    "intensity_description": "Easy",
                    "target_rpe_min": 2,
                    "target_rpe_max": 3,
                    "instructions": "Keep it easy",
                    "purpose": "Build consistency",
                },
            ],
        },
    ],
}


@pytest.fixture
def api(monkeypatch):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: UserContext("verified-owner")
    app.dependency_overrides[get_current_instant] = lambda: datetime(
        2026, 7, 1, 10, tzinfo=UTC
    )
    provider = object()
    app.dependency_overrides[get_training_block_provider] = lambda: provider
    app.state.training_plan_transactions = object()

    generate = Mock(return_value="private-plan-id")
    read = Mock(return_value=active_plan())
    monkeypatch.setattr(
        "app.modules.planning.router.generate_and_activate_training_plan", generate
    )
    monkeypatch.setattr("app.modules.planning.router.read_active_training_plan", read)
    return TestClient(app, raise_server_exceptions=False), app, provider, generate, read


class BoundaryRepository(PersistenceRepository):
    def __init__(self):
        super().__init__()
        snapshot = eligible_snapshot(target_date="2026-07-08")
        snapshot["goal"]["target_date"] = "2026-07-08"
        self.source = {"plan_approach": "kaio_path", "snapshot": snapshot}
        self.plan = None
        self.sessions = []
        self.active = False

    def read_generation_source(self, owner_id):
        self.calls.append(("source", owner_id.value))
        return self.source

    def insert_candidate(self, owner_id, plan):
        self.plan = plan
        return super().insert_candidate(owner_id, plan)

    def insert_session(self, plan_id, session):
        self.sessions.append(session)
        super().insert_session(plan_id, session)

    def activate_candidate(self, plan_id):
        super().activate_candidate(plan_id)
        self.active = True

    def read_active_plan(self, owner_id):
        self.calls.append(("read", owner_id.value))
        if not self.active:
            return []
        return [
            {
                "plan_id": "candidate-id",
                **{
                    field: getattr(self.plan, field)
                    for field in self.plan.__dataclass_fields__
                },
                **{
                    field: getattr(item, field)
                    for field in item.__dataclass_fields__
                },
            }
            for item in self.sessions
        ]


def test_post_crosses_real_generation_validation_persistence_and_read_boundary():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: UserContext("verified-owner")
    app.dependency_overrides[get_current_instant] = lambda: datetime(
        2026, 7, 1, 10, tzinfo=UTC
    )
    generated = candidate()
    provider = Mock()
    provider.generate.side_effect = [candidate(approach="mode_z"), generated]
    app.dependency_overrides[get_training_block_provider] = lambda: provider
    repository = BoundaryRepository()
    transactions = Transactions(repository)
    app.state.training_plan_transactions = transactions

    response = TestClient(app, raise_server_exceptions=False).post(
        "/planning/generate"
    )

    assert response.status_code == 200
    assert response.json()["block_focus"] == generated.block_focus
    assert response.json()["weeks"][0]["sessions"][0]["scheduled_date"] == "2026-07-06"
    assert "candidate-id" not in response.text
    assert provider.generate.call_count == 2
    first_context = provider.generate.call_args_list[0].args[0]
    second_context = provider.generate.call_args_list[1].args[0]
    assert first_context is second_context
    assert [call[0] for call in repository.calls] == [
        "source",
        "candidate",
        "session",
        "session",
        "archive",
        "activate",
        "read",
    ]
    assert repository.calls[0][1] == repository.calls[1][1] == "verified-owner"
    assert repository.calls[-1] == ("read", "verified-owner")


def test_generation_is_authenticated_runs_pipeline_and_returns_exact_public_shape(api):
    client, app, provider, generate, read = api

    app.dependency_overrides[get_current_user] = lambda: (_ for _ in ()).throw(
        HTTPException(401, "Not authenticated")
    )
    assert client.post("/planning/generate").status_code == 401
    generate.assert_not_called()

    app.dependency_overrides[get_current_user] = lambda: UserContext("verified-owner")
    response = client.post("/planning/generate")

    assert response.status_code == 200
    assert response.json() == EXPECTED_RESPONSE
    user = generate.call_args.args[0]
    assert user.user_id == "verified-owner"
    assert generate.call_args.args[1:] == (
        app.state.training_plan_transactions,
        provider,
    )
    assert generate.call_args.kwargs["current_instant"]() == datetime(
        2026, 7, 1, 10, tzinfo=UTC
    )
    read.assert_called_once()
    assert read.call_args.args[0].user_id == "verified-owner"


def test_active_plan_is_authenticated_owner_bound_ordered_and_private_fields_are_absent(
    api,
):
    client, app, _, _, read = api

    response = client.get("/planning/active")

    assert response.status_code == 200
    assert response.json() == EXPECTED_RESPONSE
    assert read.call_args.args[0].user_id == "verified-owner"
    assert "private-plan-id" not in response.text
    assert "plan_id" not in response.text
    assert "session_order" not in response.text
    assert "session_category" not in response.text

    app.dependency_overrides[get_current_user] = lambda: UserContext("foreign-owner")
    read.return_value = None
    foreign = client.get("/planning/active")
    assert foreign.status_code == 404
    assert read.call_args.args[0].user_id == "foreign-owner"

    app.dependency_overrides[get_current_user] = lambda: (_ for _ in ()).throw(
        HTTPException(401, "Not authenticated")
    )
    assert client.get("/planning/active").status_code == 401


def test_active_plan_missing_returns_404(api):
    client, _, _, _, read = api
    read.return_value = None

    response = client.get("/planning/active")

    assert response.status_code == 404
    assert response.json() == {"detail": "Active training plan not found"}


@pytest.mark.parametrize(
    ("error", "status_code", "detail"),
    [
        (GenerationContextSourceNotFound(), 404, "Planning source not found"),
        (IncompleteOnboarding(), 409, "Training plan cannot be generated"),
        (BlockedTrainingApproach(), 409, "Training plan cannot be generated"),
        (
            GenerationWindowUnavailable("private window detail"),
            409,
            "Training plan cannot be generated",
        ),
        (
            CorruptOnboardingData("private onboarding detail"),
            422,
            "Training plan input is invalid",
        ),
        (GeneratedTrainingBlockRejected(), 422, "Generated training plan is invalid"),
        (
            TrainingGenerationInvalidResponse(),
            422,
            "Generated training plan is invalid",
        ),
        (TrainingGenerationTimeout(), 503, "Generation provider unavailable"),
        (TrainingGenerationUnavailable(), 503, "Generation provider unavailable"),
        (TrainingPlanPersistenceUnavailable(), 503, "Service unavailable"),
    ],
)
def test_generation_maps_failures_to_safe_public_statuses(
    api, error, status_code, detail
):
    client, _, _, generate, _ = api
    generate.side_effect = error

    response = client.post("/planning/generate")

    assert response.status_code == status_code
    assert response.json() == {"detail": detail}
    assert str(error) not in response.text


def test_provider_configuration_is_resolved_at_api_boundary(api, monkeypatch):
    client, app, provider, generate, _ = api
    factory = Mock(return_value=provider)
    monkeypatch.setattr(
        "app.modules.planning.router.OpenAITrainingBlockProvider.from_environment",
        factory,
    )
    assert get_training_block_provider() is provider
    factory.assert_called_once_with()

    factory.side_effect = OpenAIConfigError("secret configuration detail")
    with pytest.raises(HTTPException) as caught:
        get_training_block_provider()
    assert caught.value.status_code == 503
    assert caught.value.detail == "Generation provider unavailable"

    app.dependency_overrides.pop(get_training_block_provider)
    generate.reset_mock()
    response = client.post("/planning/generate")
    assert response.status_code == 503
    assert response.json() == {"detail": "Generation provider unavailable"}
    assert "secret configuration detail" not in response.text
    generate.assert_not_called()
