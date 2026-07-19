"""Pure race-goal demand policy for Trail and Ultra readiness.

Kilometer-effort normalizes race demand from distance and climbing. The weekly-minute
anchors, loading-week anchors, and interpolation between them are product/expert
policy, not a universal scientific guarantee. ``required_peak_loading_weeks`` counts
only loading weeks that meet the returned weekly minimum; mandatory recovery and
final-taper weeks remain outside this policy and must be scheduled elsewhere.
"""

import re
from dataclasses import dataclass
from decimal import (
    ROUND_CEILING,
    ROUND_HALF_UP,
    Decimal,
    DecimalException,
    localcontext,
)
from typing import Literal

GoalDemandBasis = Literal[
    "expert_anchor", "product_interpolation", "product_floor"
]

_DECIMAL_TEXT = re.compile(
    r"[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?\Z"
)
_HUNDREDTH = Decimal("0.01")
_ELEVATION_METERS_PER_KM_EFFORT = Decimal("100")
_FLOOR_KM_EFFORT = Decimal("25.00")
_LOWER_ANCHOR_KM_EFFORT = Decimal("50.00")
_UPPER_ANCHOR_KM_EFFORT = Decimal("100.00")


@dataclass(frozen=True, slots=True)
class GoalDemand:
    """Immutable minimum peak-loading demand derived from a race goal.

    Loading-week count excludes mandatory recovery and final-taper weeks, which are
    deliberately not scheduled by this value or module.
    """

    km_effort: Decimal
    minimum_peak_weekly_minutes: int
    required_peak_loading_weeks: int
    basis: GoalDemandBasis


def calculate_goal_demand(
    distance_km: Decimal | int | str,
    positive_elevation_m: Decimal | int | str,
) -> GoalDemand:
    """Return approach-independent Trail/Ultra race-demand minimums.

    Kilometer-effort is race-demand normalization. Minute/week anchors and their
    interpolation are product/expert policy rather than a universal scientific
    guarantee. Only qualifying loading weeks count toward the returned week minimum;
    recovery and final taper remain mandatory but outside this calculation.
    """

    distance = _strict_decimal(distance_km, name="distance_km")
    elevation = _strict_decimal(
        positive_elevation_m, name="positive_elevation_m"
    )
    if distance <= 0:
        raise ValueError("distance_km_must_be_positive")
    if elevation < 0:
        raise ValueError("positive_elevation_m_must_be_non_negative")

    try:
        precision = max(
            28,
            _required_precision(distance),
            _required_precision(elevation),
        )
        with localcontext() as context:
            context.prec = precision
            raw_km_effort = distance + elevation / _ELEVATION_METERS_PER_KM_EFFORT
            km_effort = raw_km_effort.quantize(
                _HUNDREDTH, rounding=ROUND_HALF_UP
            )
    except DecimalException as error:
        raise ValueError("goal_values_are_outside_supported_decimal_range") from error

    if km_effort <= _FLOOR_KM_EFFORT:
        return GoalDemand(km_effort, 240, 2, "product_floor")
    if km_effort == _LOWER_ANCHOR_KM_EFFORT:
        return GoalDemand(km_effort, 360, 3, "expert_anchor")
    if km_effort >= _UPPER_ANCHOR_KM_EFFORT:
        return GoalDemand(km_effort, 540, 6, "expert_anchor")
    if km_effort < _LOWER_ANCHOR_KM_EFFORT:
        minutes, weeks = _interpolate(
            km_effort,
            start_effort=_FLOOR_KM_EFFORT,
            end_effort=_LOWER_ANCHOR_KM_EFFORT,
            start_minutes=240,
            end_minutes=360,
            start_weeks=2,
            end_weeks=3,
        )
    else:
        minutes, weeks = _interpolate(
            km_effort,
            start_effort=_LOWER_ANCHOR_KM_EFFORT,
            end_effort=_UPPER_ANCHOR_KM_EFFORT,
            start_minutes=360,
            end_minutes=540,
            start_weeks=3,
            end_weeks=6,
        )
    return GoalDemand(km_effort, minutes, weeks, "product_interpolation")


def _strict_decimal(value: object, *, name: str) -> Decimal:
    if isinstance(value, bool | float):
        raise TypeError(f"{name}_must_be_a_decimal_string_or_integer")
    if isinstance(value, Decimal):
        converted = value
    elif isinstance(value, int):
        converted = Decimal(value)
    elif isinstance(value, str):
        if not _DECIMAL_TEXT.fullmatch(value):
            raise ValueError(f"{name}_must_be_a_well_formed_decimal")
        try:
            converted = Decimal(value)
        except DecimalException as error:
            raise ValueError(f"{name}_must_be_a_well_formed_decimal") from error
    else:
        raise TypeError(f"{name}_must_be_a_decimal_string_or_integer")

    if not converted.is_finite():
        raise ValueError(f"{name}_must_be_finite")
    return converted


def _required_precision(value: Decimal) -> int:
    integer_digits = max(value.adjusted() + 1, 1)
    fractional_digits = max(-value.as_tuple().exponent, 0)
    return integer_digits + fractional_digits + 12


def _interpolate(
    km_effort: Decimal,
    *,
    start_effort: Decimal,
    end_effort: Decimal,
    start_minutes: int,
    end_minutes: int,
    start_weeks: int,
    end_weeks: int,
) -> tuple[int, int]:
    with localcontext() as context:
        context.prec = 28
        position = (km_effort - start_effort) / (end_effort - start_effort)
        minutes = Decimal(start_minutes) + position * (end_minutes - start_minutes)
        weeks = Decimal(start_weeks) + position * (end_weeks - start_weeks)
        return (
            int(minutes.to_integral_value(rounding=ROUND_CEILING)),
            int(weeks.to_integral_value(rounding=ROUND_CEILING)),
        )
