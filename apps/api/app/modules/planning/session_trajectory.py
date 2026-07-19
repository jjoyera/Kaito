"""Deterministic longest-outing limits for complete weekly projections.

The zero-baseline 3 km and 30 minute run/walk bootstrap is revisable Kaito product
policy, not an injury-prevention claim. Distance and duration are independent hard
maxima; whichever is reached first limits the outing, without a pace conversion.
Callers supply the complete ``WeeklyDistanceProjector`` horizon, calculate the full
trajectory, and only then slice the next 1–4 weeks needed for generation.
"""

from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

from app.modules.planning.domain import (
    _APPROACH_LOADING_RATES,
    _FINAL_TAPER_FACTOR,
    _MAX_LOADING_RATE,
    _PENULTIMATE_TAPER_FACTOR,
    _RECOVERY_FACTOR,
    ProjectedWeek,
    ProjectionPhase,
)

_KILOMETER_QUANTUM, _MINUTE_QUANTUM = Decimal("0.01"), Decimal("1")
_ZERO_BASELINE_DISTANCE_CAP, _ZERO_BASELINE_DURATION_CAP = (
    Decimal("3.00"),
    Decimal("30"),
)


@dataclass(frozen=True, slots=True)
class SessionTrajectoryWeek:
    week_number: int
    phase: ProjectionPhase
    maximum_longest_outing_kilometers: Decimal
    maximum_longest_outing_duration_minutes: int


@dataclass(frozen=True, slots=True)
class SessionTrajectory:
    weeks: tuple[SessionTrajectoryWeek, ...]


class SessionTrajectoryPolicy:
    """Calculate longest-outing caps for an already-authorized approach.

    Caps round down to 0.01 km and whole minutes. Distance progression uses the
    latest emitted loading cap, including a volume clamp. Independent duration
    progression uses its latest unrounded loading peak.
    """

    def calculate(
        self,
        baseline_longest_outing_kilometers: object,
        baseline_longest_outing_duration_minutes: object,
        authorized_approach: object,
        projected_weeks: object,
    ) -> SessionTrajectory:
        baseline_distance = _validate_distance(baseline_longest_outing_kilometers)
        baseline_duration = _validate_duration(
            baseline_longest_outing_duration_minutes
        )
        _validate_baseline_pair(baseline_distance, baseline_duration)
        weeks = _validate_projected_weeks(projected_weeks)
        if (
            not isinstance(authorized_approach, str)
            or authorized_approach not in _APPROACH_LOADING_RATES
        ):
            raise ValueError("unsupported_trajectory_approach")

        rate = min(_APPROACH_LOADING_RATES[authorized_approach], _MAX_LOADING_RATE)
        is_zero_baseline = baseline_distance == 0
        peak_distance = (
            _ZERO_BASELINE_DISTANCE_CAP if is_zero_baseline else baseline_distance
        )
        peak_duration = (
            _ZERO_BASELINE_DURATION_CAP
            if is_zero_baseline
            else Decimal(baseline_duration)
        )
        has_loaded = False
        limits: list[SessionTrajectoryWeek] = []

        for index, week in enumerate(weeks):
            if week.phase == "loading":
                if not is_zero_baseline or has_loaded:
                    peak_distance *= Decimal("1") + rate
                    peak_duration *= Decimal("1") + rate
                has_loaded = True
                emitted_distance = _round_kilometers(
                    min(peak_distance, week.estimated_kilometers)
                )
                peak_distance = emitted_distance
                duration = peak_duration
            elif week.phase == "recovery":
                emitted_distance = _round_kilometers(
                    min(
                        peak_distance * _RECOVERY_FACTOR,
                        week.estimated_kilometers,
                    )
                )
                duration = peak_duration * _RECOVERY_FACTOR
            else:
                taper_factor = (
                    _FINAL_TAPER_FACTOR
                    if index == len(weeks) - 1
                    else _PENULTIMATE_TAPER_FACTOR
                )
                emitted_distance = _round_kilometers(
                    min(peak_distance * taper_factor, week.estimated_kilometers)
                )
                duration = peak_duration * taper_factor

            limits.append(
                SessionTrajectoryWeek(
                    week_number=week.week_number,
                    phase=week.phase,
                    maximum_longest_outing_kilometers=emitted_distance,
                    maximum_longest_outing_duration_minutes=_round_minutes(duration),
                )
            )

        return SessionTrajectory(tuple(limits))


def _validate_distance(value: object) -> Decimal:
    if isinstance(value, bool) or not isinstance(value, Decimal | int):
        raise ValueError("invalid_baseline_longest_outing_kilometers")
    distance = Decimal(value)
    if not distance.is_finite() or distance < 0:
        raise ValueError("invalid_baseline_longest_outing_kilometers")
    return distance


def _validate_duration(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("invalid_baseline_longest_outing_duration_minutes")
    return value


def _validate_baseline_pair(distance: Decimal, duration: int) -> None:
    if (distance == 0) != (duration == 0):
        raise ValueError("inconsistent_baseline_longest_outing")


def _validate_projected_weeks(value: object) -> tuple[ProjectedWeek, ...]:
    if not isinstance(value, tuple) or not value:
        raise ValueError("invalid_projected_weeks")
    for expected_week_number, week in enumerate(value, start=1):
        if (
            not isinstance(week, ProjectedWeek)
            or isinstance(week.week_number, bool)
            or week.week_number != expected_week_number
            or week.phase not in {"loading", "recovery", "taper"}
            or not isinstance(week.estimated_kilometers, Decimal)
            or not week.estimated_kilometers.is_finite()
            or week.estimated_kilometers <= 0
        ):
            raise ValueError("invalid_projected_weeks")
    if tuple(week.phase for week in value) != _expected_projection_phases(len(value)):
        raise ValueError("invalid_projected_week_phases")
    return value


def _expected_projection_phases(week_count: int) -> tuple[ProjectionPhase, ...]:
    if week_count == 1:
        return ("taper",)
    if week_count == 2:
        return ("taper", "taper")
    regular_phases: tuple[ProjectionPhase, ...] = tuple(
        "recovery" if week_number % 4 == 0 else "loading"
        for week_number in range(1, week_count - 1)
    )
    return (*regular_phases, "taper", "taper")


def _round_kilometers(value: Decimal) -> Decimal:
    return value.quantize(_KILOMETER_QUANTUM, rounding=ROUND_DOWN)


def _round_minutes(value: Decimal) -> int:
    return int(value.quantize(_MINUTE_QUANTUM, rounding=ROUND_DOWN))
