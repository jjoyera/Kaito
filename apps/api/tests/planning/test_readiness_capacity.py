from dataclasses import FrozenInstanceError, fields
from decimal import Decimal
from inspect import signature

import pytest

from app.modules.planning.goal_demand import GoalDemand, calculate_goal_demand
from app.modules.planning.readiness_calendar import create_readiness_calendar
from app.modules.planning.readiness_capacity import (
    ReadinessCapacityAssessment,
    assess_readiness_capacity,
)


def _inputs(**overrides):
    values = {
        "distance_km": "50",
        "weeks_until_goal": 12,
        "recent_four_week_running_minutes": 1440,
        "weekly_available_minutes": 360,
        "recent_consistency": "fairly_consistent",
        "safety_restriction_codes": frozenset(),
        "load_increase_blocked_for_horizon": False,
    }
    values.update(overrides)
    demand = calculate_goal_demand(values.pop("distance_km"), 0)
    weeks = values.pop("weeks_until_goal")
    return {
        "goal_demand": demand,
        "readiness_calendar": create_readiness_calendar(
            weeks, demand.required_peak_loading_weeks
        ),
        **values,
    }


def _assess(**overrides):
    return assess_readiness_capacity(**_inputs(**overrides))


def test_returns_on_track_at_exact_load_and_availability_boundaries():
    assert _assess() == ReadinessCapacityAssessment(
        "on_track", Decimal("360"), 360, Decimal("0"), 5, 0, ()
    )


def test_returns_constrained_with_all_constrained_reasons_in_stable_order():
    result = _assess(
        recent_four_week_running_minutes=1200,
        recent_consistency="irregular",
        safety_restriction_codes=frozenset(
            {"reduce_demanding_session_intensity_or_duration", "no_load_increase"}
        ),
    )
    assert result.status == "constrained"
    assert result.reason_codes == (
        "current_load_below_target",
        "irregular_recent_consistency",
        "current_safety_restrictions_limit_load_or_intensity",
    )


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"weeks_until_goal": 2}, "calendar_missing_required_peak_loading_weeks"),
        (
            {"weekly_available_minutes": 359},
            "weekly_availability_below_minimum_peak_minutes",
        ),
        (
            {"weeks_until_goal": 6, "recent_four_week_running_minutes": 1200},
            "current_load_below_target_with_no_build_weeks",
        ),
        (
            {
                "recent_four_week_running_minutes": 1200,
                "load_increase_blocked_for_horizon": True,
            },
            "load_increase_blocked_for_horizon",
        ),
    ],
)
def test_each_hard_reason_independently_returns_not_feasible(overrides, reason):
    result = _assess(**overrides)
    assert result.status == "not_feasible"
    assert result.reason_codes == (reason,)


def test_collects_combined_hard_reasons_and_omits_constrained_reasons():
    result = _assess(
        weeks_until_goal=2,
        recent_four_week_running_minutes=0,
        weekly_available_minutes=0,
        recent_consistency="irregular",
        safety_restriction_codes=frozenset({"no_demanding_sessions"}),
        load_increase_blocked_for_horizon=True,
    )
    assert result.status == "not_feasible"
    assert result.reason_codes == (
        "calendar_missing_required_peak_loading_weeks",
        "weekly_availability_below_minimum_peak_minutes",
        "current_load_below_target_with_no_build_weeks",
        "load_increase_blocked_for_horizon",
    )


@pytest.mark.parametrize("consistency", ["fairly_consistent", "very_consistent"])
def test_non_irregular_consistency_does_not_constrain(consistency):
    result = _assess(recent_consistency=consistency)
    assert (result.status, result.reason_codes) == ("on_track", ())


@pytest.mark.parametrize(
    "code",
    [
        "no_load_increase",
        "no_weekly_load_increase",
        "no_demanding_sessions",
        "reduce_demanding_session_intensity_or_duration",
        "reduce_intensity",
        "reduce_duration",
    ],
)
def test_known_current_load_or_intensity_restrictions_constrain(code):
    result = _assess(safety_restriction_codes=frozenset({code}))
    assert (result.status, result.reason_codes) == (
        "constrained",
        ("current_safety_restrictions_limit_load_or_intensity",),
    )


def test_unknown_and_unrelated_restrictions_are_ignored_deterministically():
    result = _assess(
        safety_restriction_codes=frozenset(
            {"unknown_future_code", "favor_recovery_rest_or_gentle_activity"}
        )
    )
    assert (result.status, result.reason_codes) == ("on_track", ())


def test_accepts_authoritative_immutable_tuple_of_restriction_codes():
    result = _assess(safety_restriction_codes=("no_weekly_load_increase",))
    assert (result.status, result.reason_codes) == (
        "constrained",
        ("current_safety_restrictions_limit_load_or_intensity",),
    )


def test_calculates_decimal_average_gap_and_ceiling_per_build_week():
    result = _assess(recent_four_week_running_minutes=1001)
    assert (
        result.current_average_weekly_running_minutes,
        result.minute_gap,
        result.build_loading_weeks,
        result.required_additional_minutes_per_build_loading_week,
    ) == (Decimal("250.25"), Decimal("109.75"), 5, 22)


def test_zero_baseline_and_zero_availability_are_valid_but_not_feasible():
    result = _assess(
        recent_four_week_running_minutes=0, weekly_available_minutes=0
    )
    assert (
        result.current_average_weekly_running_minutes,
        result.minute_gap,
        result.required_additional_minutes_per_build_loading_week,
        result.status,
        result.reason_codes,
    ) == (
        Decimal("0"),
        Decimal("360"),
        72,
        "not_feasible",
        ("weekly_availability_below_minimum_peak_minutes",),
    )


def test_positive_gap_with_zero_build_weeks_has_no_per_week_value():
    result = _assess(weeks_until_goal=6, recent_four_week_running_minutes=1200)
    assert (result.build_loading_weeks, result.minute_gap) == (0, Decimal("60"))
    assert result.required_additional_minutes_per_build_loading_week is None


def test_output_is_immutable_and_reason_codes_are_a_tuple():
    result = _assess()
    assert isinstance(result.reason_codes, tuple)
    with pytest.raises(FrozenInstanceError):
        result.status = "constrained"


def test_approach_and_session_progression_inputs_are_absent():
    assert tuple(signature(assess_readiness_capacity).parameters) == (
        "goal_demand",
        "readiness_calendar",
        "recent_four_week_running_minutes",
        "weekly_available_minutes",
        "recent_consistency",
        "safety_restriction_codes",
        "load_increase_blocked_for_horizon",
    )
    assert {field.name for field in fields(ReadinessCapacityAssessment)} == {
        "status",
        "current_average_weekly_running_minutes",
        "target_peak_weekly_minutes",
        "minute_gap",
        "build_loading_weeks",
        "required_additional_minutes_per_build_loading_week",
        "reason_codes",
    }


@pytest.mark.parametrize(
    ("field_name", "invalid"),
    [
        ("goal_demand", None),
        ("readiness_calendar", None),
        ("recent_four_week_running_minutes", True),
        ("recent_four_week_running_minutes", 1.0),
        ("recent_four_week_running_minutes", -1),
        ("weekly_available_minutes", False),
        ("weekly_available_minutes", 1.0),
        ("weekly_available_minutes", -1),
        ("recent_consistency", "consistent"),
        ("recent_consistency", None),
        ("safety_restriction_codes", {"no_load_increase"}),
        ("safety_restriction_codes", ["no_load_increase"]),
        ("safety_restriction_codes", frozenset({1})),
        ("safety_restriction_codes", (1,)),
        ("load_increase_blocked_for_horizon", 1),
        ("load_increase_blocked_for_horizon", None),
    ],
)
def test_rejects_strict_invalid_inputs(field_name, invalid):
    inputs = _inputs()
    inputs[field_name] = invalid
    with pytest.raises((TypeError, ValueError)):
        assess_readiness_capacity(**inputs)


def test_rejects_calendar_built_for_a_different_goal_demand():
    inputs = _inputs()
    inputs["readiness_calendar"] = create_readiness_calendar(12, 2)
    with pytest.raises(ValueError, match="calendar_goal_demand_mismatch"):
        assess_readiness_capacity(**inputs)


def test_requires_actual_immutable_domain_inputs_not_structural_substitutes():
    inputs = _inputs()
    inputs["goal_demand"] = GoalDemand(Decimal("50"), 360, 3, "expert_anchor")
    assert assess_readiness_capacity(**inputs).status == "on_track"
    inputs["goal_demand"] = {
        "minimum_peak_weekly_minutes": 360,
        "required_peak_loading_weeks": 3,
    }
    with pytest.raises(TypeError):
        assess_readiness_capacity(**inputs)
