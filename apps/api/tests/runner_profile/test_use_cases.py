from collections.abc import Iterator, Mapping
from contextlib import contextmanager
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
            "restrictions": {"has_restrictions": True, "detail": "Avoid late sessions"},
        },
        "goal": {
            "modality": "trail",
            "target_date": target_date,
            "target_distance_km": 50.0,
            "positive_elevation_m": 1800.0,
            "technicality": "high",
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

    with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$") as raised:
        save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
            transactions,
        )

    assert raised.value.code == "malformed_snapshot"
    assert transactions.calls == []
    assert snapshot["profile"]["availability"]["minutes_by_day"]["monday"] is None


@pytest.mark.parametrize("value", [[], "not-an-object"])
def test_save_rejects_malformed_nested_blocks_before_opening_a_transaction(value):
    snapshot = _completed_snapshot()
    snapshot["profile"]["prior_history"] = value
    transactions = RecordingTransactions(RecordingRepository())

    with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$"):
        save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
            transactions,
        )

    assert transactions.calls == []


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("practiced_modalities", "trail"),
        ("practiced_terrain", [1]),
    ],
)
def test_save_rejects_malformed_canonical_array_answers(field, value):
    snapshot = _completed_snapshot()
    snapshot["profile"]["prior_history"][field] = value
    transactions = RecordingTransactions(RecordingRepository())

    with pytest.raises(InvalidOnboardingInput, match="^malformed_snapshot$"):
        save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
            transactions,
        )

    assert transactions.calls == []


def test_save_rejects_unknown_contract_version_without_opening_a_transaction():
    snapshot = _completed_snapshot()
    snapshot["contract_version"] = "2"
    transactions = RecordingTransactions(RecordingRepository())

    with pytest.raises(
        InvalidOnboardingInput, match="^unsupported_contract_version$"
    ) as raised:
        save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
            transactions,
        )

    assert raised.value.code == "unsupported_contract_version"
    assert transactions.calls == []


def test_save_preserves_a_sparse_typed_draft_and_returns_immutable_owner_free_result():
    snapshot = {
        "contract_version": "1",
        "state": "incomplete",
        "profile": {"prior_history": {"training_years": 1.5}},
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
    assert result.snapshot.profile["prior_history"]["training_years"] == 1.5
    assert len(repository.upserts) == 1
    assert all("owner" not in field for field in result.__dataclass_fields__)
    with pytest.raises((FrozenInstanceError, TypeError)):
        result.snapshot.profile["prior_history"] = {}


def test_save_demotes_invalid_completed_snapshot_and_persists_correctable_answers():
    snapshot = _completed_snapshot()
    snapshot["goal"].pop("technicality")
    repository = RecordingRepository()

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(repository),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert result.snapshot.goal["target_distance_km"] == 50.0
    assert any(
        diagnostic.field == "goal.technicality" and diagnostic.severity == "error"
        for diagnostic in result.diagnostics
    )
    assert repository.upserts[0][1] == result.snapshot


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("completed_race_count_range", "many"),
        ("practiced_modalities", ["road"]),
        ("practiced_terrain", ["backyard"]),
    ],
)
def test_save_demotes_noncanonical_completed_history_answers(field, value):
    snapshot = _completed_snapshot()
    snapshot["profile"]["prior_history"][field] = value
    repository = RecordingRepository()

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(repository),
    )

    assert result.snapshot.state is OnboardingState.INCOMPLETE
    assert any(diagnostic.field.endswith(field) for diagnostic in result.diagnostics)
    assert repository.upserts[0][1] == result.snapshot


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


def test_save_clears_hidden_restriction_detail_before_persisting_normalization():
    snapshot = _completed_snapshot()
    snapshot["profile"]["restrictions"] = {
        "has_restrictions": False,
        "detail": "This answer must not be retained",
    }
    repository = RecordingRepository()

    result = save_onboarding(
        UserContext("runner-1"),
        SaveOnboardingInput(snapshot=snapshot, validation_date=date(2026, 7, 13)),
        RecordingTransactions(repository),
    )

    assert result.snapshot.profile["restrictions"] == {"has_restrictions": False}
    assert repository.upserts[0][1].profile["restrictions"] == {
        "has_restrictions": False
    }
    assert (
        snapshot["profile"]["restrictions"]["detail"]
        == "This answer must not be retained"
    )


def test_read_rejects_corrupt_stored_snapshot_without_upserting_a_replacement():
    repository = RecordingRepository(stored={"contract_version": "2"})

    with pytest.raises(
        CorruptOnboardingData, match="^stored_onboarding_snapshot_is_invalid$"
    ):
        read_onboarding(
            UserContext("runner-1"),
            ReadOnboardingInput(validation_date=date(2026, 7, 13)),
            RecordingTransactions(repository),
        )

    assert len(repository.read_calls) == 1
    assert repository.upserts == []


def test_read_raises_not_found_after_the_transaction_exits_cleanly():
    transactions = RecordingTransactions(RecordingRepository())

    with pytest.raises(OnboardingNotFound, match="^onboarding_snapshot_not_found$"):
        read_onboarding(
            UserContext("runner-1"),
            ReadOnboardingInput(validation_date=date(2026, 7, 13)),
            transactions,
        )

    assert len(transactions.calls) == 1


def test_save_maps_transaction_failure_to_a_sanitized_persistence_error():
    raw_error = RuntimeError("RAW_PAYLOAD_MARKER runner-1")

    with pytest.raises(OnboardingPersistenceUnavailable) as raised:
        save_onboarding(
            UserContext("runner-1"),
            SaveOnboardingInput(
                snapshot=_completed_snapshot(), validation_date=date(2026, 7, 13)
            ),
            RecordingTransactions(RecordingRepository(), error=raw_error),
        )

    assert str(raised.value) == "service_unavailable"
    assert "RAW_PAYLOAD_MARKER" not in str(raised.value)
    assert "runner-1" not in str(raised.value)


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
    assert repository.upserts[0][1] == result.snapshot
