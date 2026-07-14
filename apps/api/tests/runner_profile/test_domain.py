from datetime import date
from math import inf, nan

import pytest

from app.modules.runner_profile.domain import (
    OnboardingSnapshot,
    OnboardingState,
    PositiveDistanceKm,
    PositiveDurationMinutes,
    PositiveElevationM,
    TargetDate,
    WeeklyAvailability,
)
from app.modules.shared.domain.value_objects import UserId


def test_user_id_is_non_empty_and_redacts_its_validation_error():
    assert UserId(" runner-123 ").value == "runner-123"
    with pytest.raises(ValueError, match="^invalid_user_id$"):
        UserId(" ")


@pytest.mark.parametrize(
    ("value_type", "value"),
    [
        (PositiveDistanceKm, 42.2),
        (PositiveDurationMinutes, 60),
        (PositiveElevationM, 1200),
    ],
)
def test_positive_measurements_accept_positive_finite_values(value_type, value):
    assert value_type(value).value == value


@pytest.mark.parametrize(
    "value_type", [PositiveDistanceKm, PositiveDurationMinutes, PositiveElevationM]
)
@pytest.mark.parametrize("value", [0, -1, inf, nan, True])
def test_positive_measurements_reject_non_positive_or_non_numeric_values(
    value_type, value
):
    with pytest.raises(ValueError, match="^invalid_positive_value$"):
        value_type(value)


def test_onboarding_state_has_stable_wire_values():
    assert {state.value for state in OnboardingState} == {"incomplete", "completed"}


def test_target_date_parses_canonical_date_and_compares_with_explicit_local_date():
    target = TargetDate.parse("2026-07-14")
    assert target.value == date(2026, 7, 14)
    assert target.is_after(date(2026, 7, 13))
    assert not target.is_after(date(2026, 7, 14))


@pytest.mark.parametrize("raw", ["2026-7-14", "14-07-2026", "not-a-date"])
def test_target_date_rejects_non_canonical_strings(raw):
    with pytest.raises(ValueError, match="^invalid_target_date$"):
        TargetDate.parse(raw)


def test_weekly_availability_validates_days_minutes_and_completion_threshold():
    availability = WeeklyAvailability({"monday": 60, "wednesday": 45, "saturday": 90})
    assert availability.total_minutes == 195
    assert availability.available_days == 3
    assert availability.meets_completion_threshold


@pytest.mark.parametrize(
    "minutes_by_day",
    [
        {"funday": 60},
        {"monday": None},
        {"monday": 14},
        {"monday": 301},
        {"monday": 60.0},
    ],
)
def test_weekly_availability_rejects_invalid_structure(minutes_by_day):
    with pytest.raises(ValueError, match="^invalid_weekly_availability$"):
        WeeklyAvailability(minutes_by_day)


def test_weekly_availability_keeps_incomplete_draft_structurally_valid():
    availability = WeeklyAvailability({"monday": 60, "friday": 60})
    assert not availability.meets_completion_threshold


def test_onboarding_snapshot_exposes_only_canonical_contract_blocks():
    snapshot = OnboardingSnapshot(
        state=OnboardingState.INCOMPLETE,
        profile={"availability": {"minutes_by_day": {"monday": 60}}},
        goal={"target_date": "2026-07-14"},
    )
    assert snapshot.contract_version == "1"
    assert snapshot.state is OnboardingState.INCOMPLETE
    assert snapshot.profile["availability"]["minutes_by_day"]["monday"] == 60
    assert snapshot.goal["target_date"] == "2026-07-14"


@pytest.mark.parametrize(
    "profile",
    [
        {"owner_id": "secret"},
        {"storage_id": 1},
        {"ui_step": 2},
        {"nested": {"user_id": "secret"}},
    ],
)
def test_onboarding_snapshot_rejects_owner_storage_and_ui_leakage(profile):
    with pytest.raises(ValueError, match="^onboarding_snapshot_leakage$"):
        OnboardingSnapshot(
            state=OnboardingState.INCOMPLETE,
            profile=profile,
            goal={},
        )


def test_onboarding_snapshot_rejects_unknown_contract_version():
    with pytest.raises(ValueError, match="^unsupported_contract_version$"):
        OnboardingSnapshot(
            contract_version="2",
            state=OnboardingState.INCOMPLETE,
            profile={},
            goal={},
        )
