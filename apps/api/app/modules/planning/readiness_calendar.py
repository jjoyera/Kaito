"""Pure temporal slot planning for goal-readiness calendars.

This module reports whether the requested peak-loading weeks fit around mandatory
recovery and taper slots. It does not assess athlete capacity or whether progression
to the target is safe.
"""

from dataclasses import dataclass
from typing import Literal

ReadinessWeekRole = Literal["build", "peak", "recovery", "taper"]


@dataclass(frozen=True, slots=True)
class ReadinessWeek:
    """One immutable, ordered temporal slot in a readiness calendar."""

    week_number: int
    role: ReadinessWeekRole


@dataclass(frozen=True, slots=True)
class ReadinessCalendar:
    """Immutable summary of peak-slot availability within a fixed horizon."""

    weeks: tuple[ReadinessWeek, ...]
    required_peak_loading_weeks: int
    available_loading_slots: int
    assigned_peak_loading_weeks: int
    missing_peak_loading_weeks: int
    is_feasible: bool


def create_readiness_calendar(
    weeks_until_goal: int,
    required_peak_loading_weeks: int,
) -> ReadinessCalendar:
    """Place build, peak, recovery, and taper slots without capacity claims.

    The pre-taper horizon follows a forward three-loading-plus-one-recovery pattern.
    Peak weeks occupy the latest loading-capable slots. Recovery and taper slots are
    never converted when the requested number of peak weeks does not fit.
    """

    _validate_positive_integer(weeks_until_goal, name="weeks_until_goal")
    _validate_positive_integer(
        required_peak_loading_weeks,
        name="required_peak_loading_weeks",
    )

    taper_weeks = min(weeks_until_goal, 2)
    pre_taper_weeks = weeks_until_goal - taper_weeks
    loading_week_numbers = tuple(
        week_number
        for week_number in range(1, pre_taper_weeks + 1)
        if week_number % 4 != 0
    )
    assigned_peak_loading_weeks = min(
        required_peak_loading_weeks, len(loading_week_numbers)
    )
    peak_week_numbers = frozenset(
        loading_week_numbers[-assigned_peak_loading_weeks:]
        if assigned_peak_loading_weeks
        else ()
    )

    weeks: list[ReadinessWeek] = []
    for week_number in range(1, weeks_until_goal + 1):
        if week_number > pre_taper_weeks:
            role: ReadinessWeekRole = "taper"
        elif week_number % 4 == 0:
            role = "recovery"
        elif week_number in peak_week_numbers:
            role = "peak"
        else:
            role = "build"
        weeks.append(ReadinessWeek(week_number=week_number, role=role))

    missing_peak_loading_weeks = (
        required_peak_loading_weeks - assigned_peak_loading_weeks
    )
    return ReadinessCalendar(
        weeks=tuple(weeks),
        required_peak_loading_weeks=required_peak_loading_weeks,
        available_loading_slots=len(loading_week_numbers),
        assigned_peak_loading_weeks=assigned_peak_loading_weeks,
        missing_peak_loading_weeks=missing_peak_loading_weeks,
        is_feasible=missing_peak_loading_weeks == 0,
    )


def _validate_positive_integer(value: object, *, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"invalid_{name}")
