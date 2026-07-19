"""Conservative temporal and availability readiness-capacity assessment.
Its informational increase does not prove safe progression; session progression,
approach, ACWR, and distance/elevation metrics are outside this phase.
"""

from dataclasses import dataclass
from decimal import ROUND_CEILING, Decimal
from typing import Literal

from app.modules.planning.goal_demand import GoalDemand
from app.modules.planning.readiness_calendar import ReadinessCalendar

ReadinessCapacityStatus = Literal["on_track", "constrained", "not_feasible"]
RecentConsistency = Literal["irregular", "fairly_consistent", "very_consistent"]
_LIMITING_CODES = frozenset(
    {
        "no_load_increase", "no_weekly_load_increase", "no_demanding_sessions",
        "reduce_demanding_session_intensity_or_duration",
        "reduce_intensity", "reduce_duration",
    }
)


@dataclass(frozen=True, slots=True)
class ReadinessCapacityAssessment:
    """Immutable initial assessment that makes no safe-progression claim."""

    status: ReadinessCapacityStatus
    current_average_weekly_running_minutes: Decimal
    target_peak_weekly_minutes: int
    minute_gap: Decimal
    build_loading_weeks: int
    required_additional_minutes_per_build_loading_week: int | None
    reason_codes: tuple[str, ...]


def assess_readiness_capacity(
    goal_demand: GoalDemand,
    readiness_calendar: ReadinessCalendar,
    recent_four_week_running_minutes: int,
    weekly_available_minutes: int,
    recent_consistency: RecentConsistency,
    safety_restriction_codes: tuple[str, ...] | frozenset[str],
    load_increase_blocked_for_horizon: bool,
) -> ReadinessCapacityAssessment:
    """Assess capacity without claiming the informational increase is safe.
    Unknown restriction codes neither authorize nor block load; only the explicit
    horizon-wide boolean persists a restriction.
    """
    _validate_inputs(
        goal_demand,
        readiness_calendar,
        recent_four_week_running_minutes,
        weekly_available_minutes,
        recent_consistency,
        safety_restriction_codes,
        load_increase_blocked_for_horizon,
    )
    average = _exact_quarter(recent_four_week_running_minutes)
    target = goal_demand.minimum_peak_weekly_minutes
    gap = max(Decimal(0), Decimal(target) - average)
    build_weeks = sum(week.role == "build" for week in readiness_calendar.weeks)
    below_target = gap > 0

    hard_checks = (
        (
            readiness_calendar.missing_peak_loading_weeks > 0,
            "calendar_missing_required_peak_loading_weeks",
        ),
        (
            weekly_available_minutes < target,
            "weekly_availability_below_minimum_peak_minutes",
        ),
        (
            below_target and build_weeks == 0,
            "current_load_below_target_with_no_build_weeks",
        ),
        (
            below_target and load_increase_blocked_for_horizon,
            "load_increase_blocked_for_horizon",
        ),
    )
    reasons = tuple(code for applies, code in hard_checks if applies)
    if reasons:
        status: ReadinessCapacityStatus = "not_feasible"
    else:
        constrained_checks = (
            (below_target, "current_load_below_target"),
            (recent_consistency == "irregular", "irregular_recent_consistency"),
            (
                any(code in _LIMITING_CODES for code in safety_restriction_codes),
                "current_safety_restrictions_limit_load_or_intensity",
            ),
        )
        reasons = tuple(code for applies, code in constrained_checks if applies)
        status = "constrained" if reasons else "on_track"

    per_build_week = None if gap and not build_weeks else 0
    if gap and build_weeks:
        per_build_week = int(
            (gap / build_weeks).to_integral_value(rounding=ROUND_CEILING)
        )
    return ReadinessCapacityAssessment(
        status, average, target, gap, build_weeks, per_build_week, reasons
    )


def _validate_inputs(
    demand: object,
    calendar: object,
    recent_minutes: object,
    available_minutes: object,
    consistency: object,
    restrictions: object,
    horizon_blocked: object,
) -> None:
    if not isinstance(demand, GoalDemand):
        raise TypeError("goal_demand_must_be_a_goal_demand")
    if not isinstance(calendar, ReadinessCalendar):
        raise TypeError("readiness_calendar_must_be_a_readiness_calendar")
    if calendar.required_peak_loading_weeks != demand.required_peak_loading_weeks:
        raise ValueError("calendar_goal_demand_mismatch")
    _non_negative_integer(recent_minutes, "recent_four_week_running_minutes")
    _non_negative_integer(available_minutes, "weekly_available_minutes")
    if consistency not in {"irregular", "fairly_consistent", "very_consistent"}:
        raise ValueError("invalid_recent_consistency")
    if not isinstance(restrictions, tuple | frozenset):
        raise TypeError("safety_restriction_codes_must_be_an_immutable_collection")
    if not all(isinstance(code, str) for code in restrictions):
        raise TypeError("safety_restriction_codes_must_contain_only_strings")
    if not isinstance(horizon_blocked, bool):
        raise TypeError("load_increase_blocked_for_horizon_must_be_a_boolean")


def _non_negative_integer(value: object, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{name}_must_be_a_non_negative_integer")


def _exact_quarter(total: int) -> Decimal:
    whole, remainder = divmod(total, 4)
    return Decimal(f"{whole}.{('00', '25', '50', '75')[remainder]}")
