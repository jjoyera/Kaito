from dataclasses import FrozenInstanceError, fields
from decimal import Decimal
from inspect import signature

import pytest

from app.modules.planning.goal_demand import GoalDemand, calculate_goal_demand


def test_normalizes_race_demand_from_distance_and_positive_elevation():
    demand = calculate_goal_demand("60", "3000")

    assert demand.km_effort == Decimal("90.00")
    assert demand.minimum_peak_weekly_minutes == 504
    assert demand.required_peak_loading_weeks == 6
    assert demand.basis == "product_interpolation"


@pytest.mark.parametrize(
    ("distance_km", "positive_elevation_m", "expected_km_effort"),
    [
        ("10", "0", Decimal("10.00")),
        (Decimal("24.994"), 0, Decimal("24.99")),
        (Decimal("24.995"), 0, Decimal("25.00")),
        ("20.125", "12.5", Decimal("20.25")),
    ],
)
def test_rounds_km_effort_deterministically_to_hundredths(
    distance_km, positive_elevation_m, expected_km_effort
):
    assert (
        calculate_goal_demand(distance_km, positive_elevation_m).km_effort
        == expected_km_effort
    )


@pytest.mark.parametrize(
    ("distance_km", "expected_km_effort"),
    [("0.01", Decimal("0.01")), ("25", Decimal("25.00"))],
)
def test_applies_product_floor_through_25_km_effort(
    distance_km, expected_km_effort
):
    demand = calculate_goal_demand(distance_km, 0)

    assert demand == GoalDemand(expected_km_effort, 240, 2, "product_floor")


@pytest.mark.parametrize(
    ("distance_km", "expected_minutes", "expected_weeks"),
    [("50", 360, 3), ("100", 540, 6)],
)
def test_returns_exact_expert_anchors(distance_km, expected_minutes, expected_weeks):
    demand = calculate_goal_demand(distance_km, 0)

    assert demand.minimum_peak_weekly_minutes == expected_minutes
    assert demand.required_peak_loading_weeks == expected_weeks
    assert demand.basis == "expert_anchor"


@pytest.mark.parametrize(
    ("distance_km", "expected_minutes", "expected_weeks"),
    [
        ("37.5", 300, 3),
        ("49.99", 360, 3),
        ("75", 450, 5),
        ("99.99", 540, 6),
    ],
)
def test_linearly_interpolates_both_policy_ranges(
    distance_km, expected_minutes, expected_weeks
):
    demand = calculate_goal_demand(distance_km, 0)

    assert demand.minimum_peak_weekly_minutes == expected_minutes
    assert demand.required_peak_loading_weeks == expected_weeks
    assert demand.basis == "product_interpolation"


@pytest.mark.parametrize(
    ("distance_km", "expected_minutes", "expected_weeks"),
    [("25.01", 241, 3), ("37.51", 301, 3), ("50.01", 361, 4)],
)
def test_rounds_interpolated_minima_upward(
    distance_km, expected_minutes, expected_weeks
):
    demand = calculate_goal_demand(distance_km, 0)

    assert demand.minimum_peak_weekly_minutes == expected_minutes
    assert demand.required_peak_loading_weeks == expected_weeks


@pytest.mark.parametrize("distance_km", ["100.01", "150", Decimal("1000")])
def test_clamps_above_upper_expert_anchor(distance_km):
    demand = calculate_goal_demand(distance_km, 0)

    assert demand.minimum_peak_weekly_minutes == 540
    assert demand.required_peak_loading_weeks == 6
    assert demand.basis == "expert_anchor"


def test_returns_an_immutable_goal_demand_value():
    demand = calculate_goal_demand("50", 0)

    with pytest.raises(FrozenInstanceError):
        demand.minimum_peak_weekly_minutes = 1



def test_approach_is_absent_from_policy_inputs_and_output():
    assert tuple(signature(calculate_goal_demand).parameters) == (
        "distance_km",
        "positive_elevation_m",
    )
    assert {field.name for field in fields(GoalDemand)} == {
        "km_effort",
        "minimum_peak_weekly_minutes",
        "required_peak_loading_weeks",
        "basis",
    }


@pytest.mark.parametrize(
    "invalid_distance",
    [
        True,
        False,
        1.5,
        0,
        "0",
        "-0.01",
        "",
        " ",
        "ten",
        "NaN",
        "Infinity",
        "-Infinity",
        Decimal("NaN"),
        Decimal("sNaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
        None,
        [],
        {},
        complex(1, 2),
    ],
)
def test_rejects_invalid_distance_numeric_forms(invalid_distance):
    with pytest.raises((TypeError, ValueError)):
        calculate_goal_demand(invalid_distance, 0)


@pytest.mark.parametrize(
    "invalid_elevation",
    [
        True,
        False,
        1.5,
        -1,
        "-0.01",
        "",
        " ",
        "high",
        "NaN",
        "Infinity",
        "-Infinity",
        Decimal("NaN"),
        Decimal("sNaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
        None,
        [],
        {},
        complex(1, 2),
    ],
)
def test_rejects_invalid_positive_elevation_numeric_forms(invalid_elevation):
    with pytest.raises((TypeError, ValueError)):
        calculate_goal_demand("50", invalid_elevation)
