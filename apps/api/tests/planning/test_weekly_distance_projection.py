from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest

from app.modules.planning import domain
from app.modules.planning.domain import WeeklyDistanceProjector


@pytest.mark.parametrize(
    ("approach", "expected"),
    [
        ("kaio_path", ("20.60", "21.22", "21.85")),
        ("mode_z", ("21.00", "22.05", "23.15")),
        ("kaioken", ("21.40", "22.90", "24.50")),
    ],
)
def test_projects_each_authorized_approach_loading_rate(approach, expected):
    projection = WeeklyDistanceProjector().project(20, 6, approach)

    assert tuple(
        week.estimated_kilometers for week in projection.weeks[:3]
    ) == tuple(Decimal(value) for value in expected)
    assert tuple(week.phase for week in projection.weeks[:3]) == (
        "loading",
        "loading",
        "loading",
    )


def test_regular_blocks_use_three_loading_weeks_and_peak_based_recovery():
    projection = WeeklyDistanceProjector().project(20, 8, "kaio_path")

    assert tuple(week.phase for week in projection.weeks) == (
        "loading",
        "loading",
        "loading",
        "recovery",
        "loading",
        "loading",
        "taper",
        "taper",
    )
    assert projection.weeks[3].estimated_kilometers == Decimal("17.48")
    assert projection.weeks[4].estimated_kilometers == Decimal("22.51")


def test_final_two_weeks_taper_from_latest_pre_taper_peak():
    projection = WeeklyDistanceProjector().project(20, 6, "mode_z")

    assert tuple(week.estimated_kilometers for week in projection.weeks) == (
        Decimal("21.00"),
        Decimal("22.05"),
        Decimal("23.15"),
        Decimal("18.52"),
        Decimal("17.36"),
        Decimal("11.58"),
    )
    assert tuple(week.phase for week in projection.weeks[-2:]) == ("taper", "taper")


@pytest.mark.parametrize(
    ("weeks", "expected"),
    [
        (1, ("10.00",)),
        (2, ("15.00", "10.00")),
        (3, ("21.00", "15.75", "10.50")),
    ],
)
def test_short_horizons_use_baseline_until_a_pre_taper_peak_exists(weeks, expected):
    projection = WeeklyDistanceProjector().project(20, weeks, "mode_z")

    assert tuple(week.week_number for week in projection.weeks) == tuple(
        range(1, weeks + 1)
    )
    assert tuple(week.estimated_kilometers for week in projection.weeks) == tuple(
        Decimal(value) for value in expected
    )


@pytest.mark.parametrize(
    ("baseline", "weeks", "approach", "expected"),
    [
        (Decimal("0"), 1, "mode_z", ("4.50",)),
        ("0.00", 2, "mode_z", ("6.75", "4.50")),
        (0.0, 3, "mode_z", ("9.45", "7.09", "4.73")),
        (0, 4, "mode_z", ("9.45", "9.92", "7.44", "4.96")),
        (
            0,
            8,
            "kaio_path",
            (
                "9.27",
                "9.55",
                "9.83",
                "7.87",
                "10.13",
                "10.43",
                "7.83",
                "5.22",
            ),
        ),
        (
            0,
            8,
            "mode_z",
            (
                "9.45",
                "9.92",
                "10.42",
                "8.33",
                "10.94",
                "11.49",
                "8.61",
                "5.74",
            ),
        ),
        (
            0,
            8,
            "kaioken",
            (
                "9.63",
                "10.30",
                "11.03",
                "8.82",
                "11.80",
                "12.62",
                "9.47",
                "6.31",
            ),
        ),
    ],
)
def test_zero_baseline_bootstraps_before_projection(
    baseline, weeks, approach, expected
):
    projection = WeeklyDistanceProjector().project(baseline, weeks, approach)

    assert tuple(week.week_number for week in projection.weeks) == tuple(
        range(1, weeks + 1)
    )
    assert tuple(week.estimated_kilometers for week in projection.weeks) == tuple(
        Decimal(value) for value in expected
    )
    assert projection.total_estimated_kilometers == sum(
        (week.estimated_kilometers for week in projection.weeks), Decimal("0.00")
    )


@pytest.mark.parametrize("baseline", [Decimal("-0"), "-0.000", -0.0])
def test_signed_zero_uses_the_weekly_bootstrap(baseline):
    projection = WeeklyDistanceProjector().project(baseline, 1, "mode_z")

    assert projection.weeks[0].estimated_kilometers == Decimal("4.50")


def test_positive_baseline_adjacent_to_zero_is_not_bootstrapped():
    projection = WeeklyDistanceProjector().project(Decimal("0.01"), 1, "mode_z")

    assert projection.weeks[0].estimated_kilometers == Decimal("0.01")


def test_total_is_the_sum_of_rounded_weekly_insights():
    projection = WeeklyDistanceProjector().project(20, 6, "mode_z")

    assert projection.total_estimated_kilometers == Decimal("113.66")
    assert projection.total_estimated_kilometers == sum(
        (week.estimated_kilometers for week in projection.weeks), Decimal("0.00")
    )


def test_projection_is_immutable():
    projection = WeeklyDistanceProjector().project(20, 4, "kaio_path")

    assert isinstance(projection.weeks, tuple)
    with pytest.raises(FrozenInstanceError):
        projection.total_estimated_kilometers = Decimal("0.00")
    with pytest.raises(FrozenInstanceError):
        projection.weeks[0].phase = "recovery"


def test_loading_rate_has_an_absolute_ten_percent_ceiling(monkeypatch):
    monkeypatch.setitem(
        domain._APPROACH_LOADING_RATES, "kaio_path", Decimal("0.25")
    )

    projection = WeeklyDistanceProjector().project(20, 3, "kaio_path")

    assert projection.weeks[0].estimated_kilometers == Decimal("22.00")


@pytest.mark.parametrize(
    "baseline",
    [
        -1,
        Decimal("-0.01"),
        Decimal("NaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
        "not-a-number",
        "",
        None,
        True,
        False,
    ],
)
def test_rejects_negative_or_invalid_baselines(baseline):
    with pytest.raises(ValueError, match="invalid_baseline_average_weekly_kilometers"):
        WeeklyDistanceProjector().project(baseline, 4, "kaio_path")


@pytest.mark.parametrize("weeks", [0, -1, 1.5, True])
def test_rejects_invalid_week_counts(weeks):
    with pytest.raises(ValueError, match="invalid_weeks_until_goal"):
        WeeklyDistanceProjector().project(20, weeks, "kaio_path")


@pytest.mark.parametrize("approach", ["modo_z", "unknown", None])
def test_rejects_unsupported_approaches_without_running_eligibility(approach):
    with pytest.raises(ValueError, match="unsupported_projection_approach"):
        WeeklyDistanceProjector().project(20, 4, approach)
