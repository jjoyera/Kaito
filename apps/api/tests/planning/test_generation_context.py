import json
from contextlib import contextmanager
from copy import deepcopy
from dataclasses import FrozenInstanceError
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.modules.auth.context import UserContext
from app.modules.planning import repository as planning_repository
from app.modules.planning.generation_context import (
    GenerationContextSourceNotFound,
    GenerationWindowUnavailable,
    ProviderGenerationContext,
    assemble_training_generation_context,
)
from app.modules.planning.use_cases import (
    BlockedTrainingApproach,
    IncompleteOnboarding,
    TrainingPlanPersistenceUnavailable,
)
from app.modules.runner_profile.use_cases import CorruptOnboardingData
from tests.planning.test_approach_eligibility import eligible_snapshot


class Repository:
    def __init__(self, source):
        self.source = source
        self.reads = []
        self.mutations = 0

    def read_generation_source(self, owner_id):
        self.reads.append(owner_id.value)
        return self.source


class Transactions:
    def __init__(self, repository, *, fail=False):
        self.repository = repository
        self.fail = fail
        self.entries = 0
        self.users = []

    @contextmanager
    def __call__(self, user):
        self.entries += 1
        self.users.append(user)
        if self.fail:
            raise RuntimeError("database unavailable")
        yield self.repository


def source_for(target_date: date, *, approach="kaio_path", snapshot=None):
    stored = deepcopy(
        snapshot or eligible_snapshot(target_date=target_date.isoformat())
    )
    stored["goal"]["target_date"] = target_date.isoformat()
    return {"plan_approach": approach, "snapshot": stored}


def assemble(
    target_date: date,
    *,
    now=datetime(2026, 7, 1, 10, tzinfo=UTC),
    approach="kaio_path",
    snapshot=None,
    user=UserContext("verified-owner", "private@example.test"),
):
    repository = Repository(
        source_for(target_date, approach=approach, snapshot=snapshot)
    )
    transactions = Transactions(repository)
    result = assemble_training_generation_context(
        user,
        transactions,
        current_instant=lambda: now,
    )
    return result, repository, transactions


def test_sql_adapter_uses_one_owner_bound_join_for_draft_and_onboarding():
    row = {"plan_approach": "kaio_path", "snapshot": {"contract_version": "1"}}

    class Result:
        def mappings(self):
            return self

        def one_or_none(self):
            return row

    class Connection:
        def __init__(self):
            self.calls = []

        def execute(self, statement, values):
            self.calls.append((str(statement), values))
            return Result()

    connection = Connection()
    repository = planning_repository.SqlAlchemyTrainingPlanRepository(connection)

    owner = type("Owner", (), {"value": "verified-owner"})()
    assert repository.read_generation_source(owner) == row
    assert len(connection.calls) == 1
    statement, values = connection.calls[0]
    assert "JOIN onboarding_snapshots" in statement
    assert "tp.owner_id = :owner_id" in statement
    assert "tp.status = 'draft'" in statement
    assert values == {"owner_id": "verified-owner"}
    assert "plan_id" not in statement


def test_uses_verified_user_context_for_one_transaction_and_one_combined_read_only():
    result, repository, transactions = assemble(date(2026, 8, 2))

    assert result.authorized_approach == "kaio_path"
    assert transactions.entries == 1
    assert transactions.users == [UserContext("verified-owner", "private@example.test")]
    assert repository.reads == ["verified-owner"]
    assert repository.mutations == 0


@pytest.mark.parametrize("source", [None, {}])
def test_missing_or_foreign_owner_source_fails_before_dto_creation(source):
    repository = Repository(source)

    with pytest.raises(
        GenerationContextSourceNotFound,
        match="generation_context_source_not_found",
    ):
        assemble_training_generation_context(
            UserContext("verified-owner"),
            Transactions(repository),
            current_instant=lambda: datetime(2026, 7, 1, tzinfo=UTC),
        )

    assert repository.reads == ["verified-owner"]


@pytest.mark.parametrize(
    "mutate",
    [
        lambda value: value.update(snapshot="not-an-object"),
        lambda value: value["snapshot"].update(contract_version="unknown"),
    ],
)
def test_corrupt_source_fails_closed(mutate):
    source = source_for(date(2026, 8, 2))
    mutate(source)

    with pytest.raises(
        CorruptOnboardingData,
        match="stored_onboarding_snapshot_is_invalid",
    ):
        assemble_training_generation_context(
            UserContext("verified-owner"),
            Transactions(Repository(source)),
            current_instant=lambda: datetime(2026, 7, 1, tzinfo=UTC),
        )


def test_incomplete_onboarding_fails_before_provider_dto_creation():
    source = source_for(date(2026, 8, 2))
    source["snapshot"]["state"] = "incomplete"

    with pytest.raises(IncompleteOnboarding, match="onboarding_incomplete"):
        assemble_training_generation_context(
            UserContext("verified-owner"),
            Transactions(Repository(source)),
            current_instant=lambda: datetime(2026, 7, 1, tzinfo=UTC),
        )


def test_completed_snapshot_with_missing_required_data_is_incomplete_not_corrupt():
    source = source_for(date(2026, 8, 2))
    del source["snapshot"]["profile"]["availability"]

    with pytest.raises(IncompleteOnboarding, match="onboarding_incomplete"):
        assemble_training_generation_context(
            UserContext("verified-owner"),
            Transactions(Repository(source)),
            current_instant=lambda: datetime(2026, 7, 1, tzinfo=UTC),
        )


def test_recalculates_eligibility_and_rejects_now_blocked_persisted_approach():
    snapshot = eligible_snapshot(target_date="2026-10-10")
    snapshot["profile"]["physical_status"].update(
        status="recovering",
        has_pain_or_limitation=True,
        pain_or_limitation_affects_running=True,
    )

    with pytest.raises(BlockedTrainingApproach, match="blocked_approach"):
        assemble(date(2026, 10, 10), approach="mode_z", snapshot=snapshot)


def test_unavailable_read_fails_closed_without_leaking_raw_error():
    with pytest.raises(
        TrainingPlanPersistenceUnavailable, match="service_unavailable"
    ) as caught:
        assemble_training_generation_context(
            UserContext("verified-owner"),
            Transactions(Repository(None), fail=True),
            current_instant=lambda: datetime(2026, 7, 1, tzinfo=UTC),
        )

    assert str(caught.value) == "service_unavailable"


@pytest.mark.parametrize("horizon_weeks", [1, 2, 3, 4, 5, 9])
def test_calculates_inclusive_full_horizon_then_slices_one_to_four_weeks(horizon_weeks):
    generation_start = date(2026, 7, 6)
    target = generation_start + timedelta(days=horizon_weeks * 7 - 1)

    result, _, _ = assemble(target)

    assert result.generation_window_start == generation_start
    assert result.goal_date == target
    assert result.full_horizon_week_count == horizon_weeks
    assert len(result.provider_context.weeks) == min(4, horizon_weeks)
    assert result.provider_context.weeks[-1].window_end == min(
        generation_start + timedelta(days=min(4, horizon_weeks) * 7 - 1), target
    )


def test_complete_before_slice_preserves_early_full_horizon_phases_and_trajectory():
    result, _, _ = assemble(date(2026, 8, 30))

    assert result.full_horizon_week_count == 8
    assert [week.phase for week in result.provider_context.weeks] == [
        "loading",
        "loading",
        "loading",
        "recovery",
    ]
    assert (
        result.provider_context.weeks[0].maximum_longest_outing_kilometers
        == Decimal("18.02")
    )


def test_nearby_target_truncates_partial_final_week_exactly_at_goal_date():
    result, _, _ = assemble(date(2026, 7, 8))

    assert result.full_horizon_week_count == 1
    assert result.provider_context.weeks[0].window_start == date(2026, 7, 6)
    assert result.provider_context.weeks[0].window_end == date(2026, 7, 8)


def test_target_before_strictly_next_monday_has_no_generation_window():
    with pytest.raises(
        GenerationWindowUnavailable, match="goal_before_generation_window"
    ):
        assemble(date(2026, 7, 5))


@pytest.mark.parametrize(
    ("now", "expected_start"),
    [
        (datetime(2026, 7, 6, 8, tzinfo=UTC), date(2026, 7, 13)),
        (datetime(2026, 7, 5, 8, tzinfo=UTC), date(2026, 7, 6)),
        (datetime(2026, 7, 5, 22, 30, tzinfo=UTC), date(2026, 7, 13)),
        (datetime(2026, 3, 29, 0, 30, tzinfo=UTC), date(2026, 3, 30)),
        (datetime(2026, 3, 29, 22, 30, tzinfo=UTC), date(2026, 4, 6)),
        (datetime(2026, 10, 25, 0, 30, tzinfo=UTC), date(2026, 10, 26)),
    ],
)
def test_europe_madrid_strict_next_monday_utc_midnight_and_dst_boundaries(
    now, expected_start
):
    target = expected_start + timedelta(days=13)
    result, _, _ = assemble(target, now=now)

    assert result.generation_window_start == expected_start


def test_rejects_naive_clock():
    with pytest.raises(
        GenerationWindowUnavailable, match="current_instant_must_be_aware"
    ):
        assemble(date(2026, 8, 2), now=datetime(2026, 7, 1, 10))


def test_zero_baselines_keep_weekly_and_longest_outing_bootstraps_separate():
    snapshot = eligible_snapshot(target_date="2026-8-30")
    baseline = snapshot["profile"]["baseline_4_weeks"]
    baseline.update(
        distance_km=0,
        sessions=0,
        positive_elevation_m=0,
        longest_outing_km=0,
        total_running_minutes=0,
        longest_outing_duration_minutes=0,
        longest_outing_positive_elevation_m=0,
        recent_consistency="irregular",
    )

    result, _, _ = assemble(date(2026, 8, 30), snapshot=snapshot)
    first = result.provider_context.weeks[0]

    assert first.target_running_kilometers == Decimal("9.27")
    assert first.maximum_longest_outing_kilometers == Decimal("3.00")
    assert first.maximum_longest_outing_duration_minutes == 30


@pytest.mark.parametrize("restriction", ["no_load_increase", "no_weekly_load_increase"])
def test_backend_safety_codes_block_load_increase_for_every_initial_week(restriction):
    snapshot = eligible_snapshot(target_date="2026-8-30")
    physical = snapshot["profile"]["physical_status"]
    if restriction == "no_load_increase":
        physical["has_pain_or_limitation"] = True
        physical["pain_or_limitation_affects_running"] = False
    else:
        physical["status"] = "carrying_fatigue"

    result, _, _ = assemble(date(2026, 8, 30), snapshot=snapshot)

    assert result.provider_context.safety.load_increase_blocked_for_horizon is True
    assert all(week.load_increase_blocked for week in result.provider_context.weeks)
    assert restriction in result.provider_context.safety.restriction_codes


def test_unrelated_safety_code_does_not_invent_horizon_load_block():
    snapshot = eligible_snapshot(target_date="2026-8-30")
    snapshot["profile"]["physical_status"].update(
        status="recovering",
        has_pain_or_limitation=False,
    )
    result, _, _ = assemble(date(2026, 8, 30), snapshot=snapshot)

    assert "no_demanding_sessions" in result.provider_context.safety.restriction_codes
    assert result.provider_context.safety.load_increase_blocked_for_horizon is True


def test_provider_dto_has_strict_stable_shape_and_decimal_string_serialization():
    result, _, _ = assemble(date(2026, 7, 8))
    payload = json.loads(result.provider_context.model_dump_json())

    assert payload == {
        "authorized_approach": "kaio_path",
        "generation_window_start": "2026-07-06",
        "goal_date": "2026-07-08",
        "goal": {
            "modality": "trail",
            "target_distance_kilometers": "50.0",
            "positive_elevation_meters": "2000",
            "km_effort": "70.00",
        },
        "readiness": {
            "status": "not_feasible",
            "minimum_peak_weekly_minutes": 432,
            "required_peak_loading_weeks": 5,
            "reason_codes": [
                "calendar_missing_required_peak_loading_weeks",
                "weekly_availability_below_minimum_peak_minutes",
                "current_load_below_target_with_no_build_weeks",
            ],
        },
        "safety": {
            "restriction_codes": [],
            "load_increase_blocked_for_horizon": False,
        },
        "availability": [
            {"weekday": "monday", "minutes": 75},
            {"weekday": "tuesday", "minutes": 75},
            {"weekday": "thursday", "minutes": 75},
            {"weekday": "saturday", "minutes": 75},
        ],
        "weeks": [
            {
                "week_number": 1,
                "window_start": "2026-07-06",
                "window_end": "2026-07-08",
                "phase": "taper",
                "readiness_role": "taper",
                "target_running_kilometers": "15.00",
                "maximum_longest_outing_kilometers": "8.75",
                "maximum_longest_outing_duration_minutes": 60,
                "load_increase_blocked": False,
            }
        ],
    }


def test_internal_and_provider_contexts_are_immutable_and_forbid_extra_fields():
    result, _, _ = assemble(date(2026, 8, 2))

    with pytest.raises(FrozenInstanceError):
        result.full_horizon_week_count = 1
    with pytest.raises(ValidationError):
        ProviderGenerationContext.model_validate(
            {**result.provider_context.model_dump(), "owner_id": "forbidden"}
        )


def test_provider_dto_recursively_excludes_private_and_unnecessary_keys():
    result, _, _ = assemble(date(2026, 8, 2))
    payload = result.provider_context.model_dump(mode="json")
    forbidden = {
        "owner", "owner_id", "user", "user_id", "plan", "plan_id", "email",
        "claims", "token", "access_token", "refresh_token", "created_at", "updated_at",
        "snapshot", "onboarding", "pain_or_limitation_detail", "database_row",
    }

    def keys(value):
        if isinstance(value, dict):
            return set(value).union(*(keys(item) for item in value.values()))
        if isinstance(value, list):
            return set().union(*(keys(item) for item in value), set())
        return set()

    assert keys(payload).isdisjoint(forbidden)
