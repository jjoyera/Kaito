from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from copy import deepcopy
from dataclasses import FrozenInstanceError
from datetime import date

import pytest

from app.modules.auth.context import UserContext
from app.modules.runner_profile.domain import OnboardingState
from app.modules.runner_profile.use_cases import (
    CorruptOnboardingData,
    InvalidOnboardingInput,
    OnboardingNotFound,
    OnboardingPersistenceUnavailable,
    ReadOnboardingInput,
    SaveOnboardingInput,
    read_onboarding,
    save_onboarding,
)


def _completed_snapshot(*, target_date: str = "2026-08-01") -> dict:
    return {
        "contract_version": "1",
        "state": "completed",
        "profile": {
            "prior_history": {"longest_completed_distance_km": 42.2},
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
        },
        "goal": {
            "modality": "trail",
            "target_date": target_date,
            "target_distance_km": 50.0,
            "positive_elevation_m": 1800.0,
        },
    }


class RecordingRepository:
    def __init__(
        self, stored: Mapping[str, object] | None = None, error: Exception | None = None
    ):
        self.stored = stored
        self.error = error
        self.read_calls = []
        self.upserts = []

    def read(self, owner_id):
        self.read_calls.append(owner_id)
        if self.error:
            raise self.error
        return self.stored

    def upsert(self, owner_id, snapshot):
        self.upserts.append((owner_id, snapshot))
        if self.error:
            raise self.error


class StatefulRecordingRepository(RecordingRepository):
    def upsert(self, owner_id, snapshot):
        super().upsert(owner_id, snapshot)
        self.stored = {
            "contract_version": snapshot.contract_version,
            "state": snapshot.state.value,
            "profile": dict(snapshot.profile),
            "goal": dict(snapshot.goal),
        }


class RecordingTransactions:
    def __init__(self, repository: RecordingRepository, error: Exception | None = None):
        self.repository = repository
        self.error = error
        self.calls = []

    @contextmanager
    def __call__(self, user: UserContext) -> Iterator[RecordingRepository]:
        self.calls.append(user)
        if self.error:
            raise self.error
        yield self.repository


def test_save_rejects_malformed_draft_without_opening_a_transaction_or_mutating_data():
    snapshot = {
        "contract_version": "1",
        "state": "incomplete",
        "profile": {"availability": {"minutes_by_day": {"monday": None}}},
        "goal": {},
    }
    transactions = RecordingTransactions(RecordingRepository())
    user = UserContext("runner-1")
    input_data = SaveOnboardingInput(
        snapshot=snapshot, validation_date=date(2026, 7, 13)
    )

    with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$") as raised:
        save_onboarding(user, input_data, transactions)

    assert raised.value.code == "malformed_snapshot"
    assert transactions.calls == []
    assert snapshot["profile"]["availability"]["minutes_by_day"]["monday"] is None


@pytest.mark.parametrize("value", [[], "not-an-object"])
def test_save_rejects_malformed_nested_blocks_before_opening_a_transaction(value):
    snapshot = _completed_snapshot()
    snapshot["profile"]["prior_history"] = value
    transactions = RecordingTransactions(RecordingRepository())
    user = UserContext("runner-1")
    input_data = SaveOnboardingInput(
        snapshot=snapshot, validation_date=date(2026, 7, 13)
    )

    with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$"):
        save_onboarding(user, input_data, transactions)

    assert transactions.calls == []


@pytest.mark.parametrize(
    ("block", "field", "value"),
    [
        ("prior_history", "training_years", None),
        ("prior_history", "training_years", 1.5),
        ("prior_history", "completed_race_count_range", None),
        ("prior_history", "completed_race_count_range", "one_to_three"),
        ("prior_history", "practiced_modalities", None),
        ("prior_history", "practiced_modalities", ["trail"]),
        ("prior_history", "practiced_terrain", None),
        ("prior_history", "practiced_terrain", ["mountain"]),
        ("goal", "technicality", None),
        ("goal", "technicality", "high"),
    ],
)
def test_save_rejects_removed_fields_before_transaction_and_preserves_snapshot(
    block, field, value
):
    stored = _completed_snapshot()
    snapshot = deepcopy(stored)
    target = snapshot["goal"] if block == "goal" else snapshot["profile"][block]
    target[field] = value
    repository = RecordingRepository(stored=stored)
    transactions = RecordingTransactions(repository)

    with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$"):
        save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
            transactions,
        )

    assert transactions.calls == []
    assert repository.upserts == []
    assert repository.stored == stored


@pytest.mark.parametrize("minutes", [14, 301, True, 45.5])
def test_save_rejects_invalid_availability_values_without_mutating_stored_snapshot(
    minutes,
):
    stored = _completed_snapshot()
    snapshot = deepcopy(stored)
    snapshot["profile"]["availability"]["minutes_by_day"]["monday"] = minutes
    repository = RecordingRepository(stored=stored)
    transactions = RecordingTransactions(repository)

    with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$") as raised:
        save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
            transactions,
        )

    assert raised.value.code == "malformed_snapshot"
    assert transactions.calls == []
    assert repository.upserts == []
    assert repository.stored == stored


def test_save_rejects_unknown_contract_version_without_opening_a_transaction():
    snapshot = _completed_snapshot()
    snapshot["contract_version"] = "2"
    transactions = RecordingTransactions(RecordingRepository())
    user = UserContext("runner-1")
    input_data = SaveOnboardingInput(
        snapshot=snapshot, validation_date=date(2026, 7, 13)
    )

    with pytest.raises(
        InvalidOnboardingInput, match="^unsupported_contract_version$"
    ) as raised:
        save_onboarding(user, input_data, transactions)

    assert raised.value.code == "unsupported_contract_version"
    assert transactions.calls == []


def test_save_preserves_a_sparse_typed_draft_and_returns_immutable_owner_free_result():
    snapshot = {
        "contract_version": "1",
        "state": "incomplete",
        "profile": {"prior_history": {"longest_completed_distance_km": 1.5}},
        "goal": {},
    }
    repository = RecordingRepository()
    transactions = RecordingTransactions(repository)

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        transactions,
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert result.snapshot.profile["prior_history"][
        "longest_completed_distance_km"
    ] == pytest.approx(1.5)
    assert len(repository.upserts) == 1
    assert all("owner" not in field for field in result.__dataclass_fields__)
    with pytest.raises((FrozenInstanceError, TypeError)):
        result.snapshot.profile["prior_history"] = {}


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"max_altitude_m": -1}, "goal.max_altitude_m"),
        (
            {
                "modality": "ocr",
                "obstacle_count": 10,
                "obstacle_difficulty": "extreme",
            },
            "goal.obstacle_difficulty",
        ),
    ],
)
def test_save_demotes_noncanonical_completed_optional_goal_answers(changes, field):
    snapshot = _completed_snapshot()
    snapshot["goal"].update(changes)

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(RecordingRepository()),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert any(diagnostic.field == field for diagnostic in result.diagnostics)


def test_save_accepts_canonical_baseline_with_recent_consistency():
    snapshot = _completed_snapshot()
    repository = RecordingRepository()

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(repository),
    )

    assert result.snapshot.state is OnboardingState.COMPLETED
    assert result.diagnostics == ()


def test_save_then_read_round_trips_exact_availability_for_the_same_owner():
    snapshot = _completed_snapshot()
    repository = StatefulRecordingRepository()
    transactions = RecordingTransactions(repository)
    user = UserContext("runner-1")
    validation_date = date(2026, 7, 13)

    saved = save_onboarding(
        user,
        SaveOnboardingInput(snapshot=snapshot, validation_date=validation_date),
        transactions,
    )
    loaded = read_onboarding(
        user,
        ReadOnboardingInput(validation_date=validation_date),
        transactions,
    )

    expected_minutes_by_day = {"monday": 45, "wednesday": 75, "saturday": 120}
    assert (
        saved.snapshot.profile["availability"]["minutes_by_day"]
        == expected_minutes_by_day
    )
    assert (
        loaded.snapshot.profile["availability"]["minutes_by_day"]
        == expected_minutes_by_day
    )
    assert len(repository.upserts) == 1
    assert len(repository.read_calls) == 1


def test_equivalent_save_retry_keeps_one_current_exact_availability_snapshot():
    snapshot = _completed_snapshot()
    repository = StatefulRecordingRepository()
    transactions = RecordingTransactions(repository)
    user = UserContext("runner-1")
    command = SaveOnboardingInput(
        snapshot=snapshot, validation_date=date(2026, 7, 13)
    )

    save_onboarding(user, command, transactions)
    retried = save_onboarding(user, command, transactions)
    loaded = read_onboarding(
        user,
        ReadOnboardingInput(validation_date=date(2026, 7, 13)),
        transactions,
    )

    expected_minutes_by_day = {"monday": 45, "wednesday": 75, "saturday": 120}
    if (
        retried.snapshot.profile["availability"]["minutes_by_day"]
        != expected_minutes_by_day
        or loaded.snapshot.profile["availability"]["minutes_by_day"]
        != expected_minutes_by_day
    ):
        pytest.fail("availability round-trip mismatch", pytrace=False)
    assert len(repository.upserts) == 2
    assert len(repository.read_calls) == 1


def test_save_retains_modality_specific_clearing_after_contract_reduction():
    snapshot = _completed_snapshot()
    snapshot["goal"].update(
        {
            "obstacle_count": 10,
            "obstacle_difficulty": "high",
            "target_loops": 4,
        }
    )

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(RecordingRepository()),
    )

    assert result.snapshot.goal == {
        "modality": "trail",
        "target_date": "2026-08-01",
        "target_distance_km": 50.0,
        "positive_elevation_m": 1800.0,
    }


def test_save_removes_stray_training_hours_from_complete_canonical_baseline():
    snapshot = _completed_snapshot()
    snapshot["profile"]["baseline_4_weeks"]["training_hours"] = 8.5
    repository = RecordingRepository()

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(repository),
    )

    [(_, persisted)] = repository.upserts
    assert result.snapshot.state is OnboardingState.COMPLETED
    assert result.diagnostics == ()
    assert "training_hours" not in result.snapshot.profile["baseline_4_weeks"]
    assert "training_hours" not in persisted.profile["baseline_4_weeks"]


@pytest.mark.parametrize("value", ["sometimes", 1])
def test_save_demotes_or_rejects_invalid_recent_consistency(value):
    snapshot = _completed_snapshot()
    snapshot["profile"]["baseline_4_weeks"]["recent_consistency"] = value
    transactions = RecordingTransactions(RecordingRepository())

    if isinstance(value, str):
        result = save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
            transactions,
        )
        assert result.snapshot.state is OnboardingState.INCOMPLETE
        assert any(
            diagnostic.field == "profile.baseline_4_weeks.recent_consistency"
            for diagnostic in result.diagnostics
        )
    else:
        user = UserContext("runner-1")
        command = SaveOnboardingInput(
            snapshot=snapshot, validation_date=date(2026, 7, 13)
        )

        with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$"):
            save_onboarding(user, command, transactions)


def test_stray_training_hours_does_not_replace_required_recent_consistency():
    snapshot = _completed_snapshot()
    baseline = snapshot["profile"]["baseline_4_weeks"]
    baseline.pop("recent_consistency")
    baseline["training_hours"] = 8.5
    repository = RecordingRepository(stored=snapshot)

    result = read_onboarding(
        UserContext("runner-1"),
        ReadOnboardingInput(validation_date=date(2026, 7, 13)),
        RecordingTransactions(repository),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert any(
        diagnostic.field == "profile.baseline_4_weeks.recent_consistency"
        and diagnostic.code == "required"
        for diagnostic in result.diagnostics
    )


def test_save_strips_legacy_restrictions_from_valid_training_preferences():
    snapshot = _completed_snapshot()
    snapshot["profile"]["restrictions"] = {
        "has_restrictions": True,
        "detail": "Legacy value",
    }
    repository = RecordingRepository()

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(repository),
    )

    assert result.snapshot.state is OnboardingState.COMPLETED
    assert result.diagnostics == ()
    assert "restrictions" not in result.snapshot.profile
    ((_, persisted_snapshot),) = repository.upserts
    assert "restrictions" not in persisted_snapshot.profile
    assert "restrictions" in snapshot["profile"]


def test_save_demotes_completed_snapshot_when_a_training_preference_is_missing():
    snapshot = _completed_snapshot()
    snapshot["profile"]["training_preferences"].pop("gym_access")

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(RecordingRepository()),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert any(
        diagnostic.code == "required"
        and diagnostic.field == "profile.training_preferences.gym_access"
        for diagnostic in result.diagnostics
    )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("mountain_trail_access", "daily"),
        ("gym_access", "no"),
        ("planning_preference", "random"),
    ],
)
def test_save_demotes_completed_snapshot_for_invalid_training_preference(field, value):
    snapshot = _completed_snapshot()
    snapshot["profile"]["training_preferences"][field] = value

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(RecordingRepository()),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert any(
        diagnostic.code == "out_of_range"
        and diagnostic.field == f"profile.training_preferences.{field}"
        for diagnostic in result.diagnostics
    )


def test_read_rejects_stale_removed_field_without_upserting_a_replacement():
    stored = _completed_snapshot()
    stored["goal"]["technicality"] = "high"
    repository = RecordingRepository(stored=stored)
    user = UserContext("runner-1")
    input_data = ReadOnboardingInput(validation_date=date(2026, 7, 13))
    transactions = RecordingTransactions(repository)

    with pytest.raises(
        CorruptOnboardingData, match="^stored_onboarding_snapshot_is_invalid$"
    ):
        read_onboarding(user, input_data, transactions)

    assert len(repository.read_calls) == 1
    assert repository.upserts == []


def test_read_raises_not_found_after_the_transaction_exits_cleanly():
    transactions = RecordingTransactions(RecordingRepository())
    user = UserContext("runner-1")
    input_data = ReadOnboardingInput(validation_date=date(2026, 7, 13))

    with pytest.raises(OnboardingNotFound, match="^onboarding_snapshot_not_found$"):
        read_onboarding(user, input_data, transactions)

    assert len(transactions.calls) == 1


def test_save_maps_transaction_failure_to_a_sanitized_persistence_error():
    raw_error = RuntimeError("RAW_PAYLOAD_MARKER runner-1")
    user = UserContext("runner-1")
    input_data = SaveOnboardingInput(
        snapshot=_completed_snapshot(), validation_date=date(2026, 7, 13)
    )
    transactions = RecordingTransactions(RecordingRepository(), error=raw_error)

    with pytest.raises(OnboardingPersistenceUnavailable) as raised:
        save_onboarding(user, input_data, transactions)

    assert str(raised.value) == "service_unavailable"
    assert "RAW_PAYLOAD_MARKER" not in str(raised.value)
    assert "runner-1" not in str(raised.value)


@pytest.mark.parametrize(
    ("availability", "expected_code"),
    [
        ({"monday": 75, "wednesday": 75}, "availability_insufficient_days"),
        (
            {"monday": 45, "wednesday": 45, "saturday": 45},
            "availability_insufficient_total",
        ),
    ],
)
def test_save_reports_bounded_availability_threshold_diagnostics(
    availability, expected_code
):
    snapshot = _completed_snapshot()
    snapshot["profile"]["availability"]["minutes_by_day"] = availability

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(RecordingRepository()),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert [
        (item.code, item.metadata)
        for item in result.diagnostics
        if item.code.startswith("availability_")
    ] == [(expected_code, {})]


def test_save_uses_the_explicit_validation_date_for_date_demotion():
    repository = RecordingRepository()

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(
            snapshot=_completed_snapshot(target_date="2026-07-13"),
            validation_date=date(2026, 7, 13),
        ),
        RecordingTransactions(repository),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert any(
        diagnostic.code == "target_date_not_future"
        and diagnostic.field == "goal.target_date"
        for diagnostic in result.diagnostics
    )
    ((_, persisted_snapshot),) = repository.upserts
    assert persisted_snapshot == result.snapshot
