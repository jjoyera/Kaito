from dataclasses import FrozenInstanceError
from decimal import Decimal

import pytest

from app.modules.planning import session_trajectory
from app.modules.planning.domain import ProjectedWeek
from app.modules.planning.session_trajectory import SessionTrajectoryPolicy


def _weeks(*phases, kilometers="100.00"):
    return tuple(
        ProjectedWeek(index, phase, Decimal(kilometers))
        for index, phase in enumerate(phases, start=1)
    )


def _varied_weeks(*values):
    return tuple(
        ProjectedWeek(index, phase, Decimal(kilometers))
        for index, (phase, kilometers) in enumerate(values, start=1)
    )


def _limits(trajectory):
    return tuple(
        (
            week.maximum_longest_outing_kilometers,
            week.maximum_longest_outing_duration_minutes,
        )
        for week in trajectory.weeks
    )


@pytest.mark.parametrize(
    ("approach", "expected"),
    [
        ("kaio_path", (Decimal("10.30"), 103)),
        ("mode_z", (Decimal("10.50"), 105)),
        ("kaioken", (Decimal("10.70"), 107)),
    ],
)
def test_applies_each_authorized_approach_loading_rate(approach, expected):
    trajectory = SessionTrajectoryPolicy().calculate(
        Decimal("10.00"), 100, approach, _weeks("loading", "taper", "taper")
    )

    assert _limits(trajectory)[0] == expected


def test_clamped_loading_cap_controls_later_recovery_loading_and_taper_distance():
    weeks = _varied_weeks(
        ("loading", "100"),
        ("loading", "100"),
        ("loading", "4"),
        ("recovery", "100"),
        ("loading", "100"),
        ("loading", "100"),
        ("taper", "100"),
        ("taper", "100"),
    )

    trajectory = SessionTrajectoryPolicy().calculate(
        Decimal("10"), 100, "kaio_path", weeks
    )

    assert tuple(distance for distance, _ in _limits(trajectory)[2:]) == (
        Decimal("4.00"),
        Decimal("3.20"),
        Decimal("4.12"),
        Decimal("4.24"),
        Decimal("3.18"),
        Decimal("2.12"),
    )


def test_distance_clamp_keeps_the_independent_duration_cap():
    weeks = _varied_weeks(
        ("loading", "4.25"), ("taper", "100"), ("taper", "100")
    )

    trajectory = SessionTrajectoryPolicy().calculate(
        Decimal("10"), 100, "kaioken", weeks
    )

    assert _limits(trajectory)[0] == (Decimal("4.25"), 107)


def test_zero_baseline_bootstraps_before_loading_progression():
    trajectory = SessionTrajectoryPolicy().calculate(
        0, 0, "mode_z", _weeks("loading", "loading", "loading", "taper", "taper")
    )

    assert _limits(trajectory) == (
        (Decimal("3.00"), 30),
        (Decimal("3.15"), 31),
        (Decimal("3.30"), 33),
        (Decimal("2.47"), 24),
        (Decimal("1.65"), 16),
    )


@pytest.mark.parametrize(
    ("distance", "duration", "phases", "expected"),
    [
        (0, 0, ("taper",), ((Decimal("1.50"), 15),)),
        (
            0,
            0,
            ("taper", "taper"),
            ((Decimal("2.25"), 22), (Decimal("1.50"), 15)),
        ),
        (Decimal("10"), 100, ("taper",), ((Decimal("5.00"), 50),)),
        (
            Decimal("10"),
            100,
            ("taper", "taper"),
            ((Decimal("7.50"), 75), (Decimal("5.00"), 50)),
        ),
    ],
)
def test_short_horizons_taper_from_the_applicable_reference(
    distance, duration, phases, expected
):
    trajectory = SessionTrajectoryPolicy().calculate(
        distance, duration, "mode_z", _weeks(*phases)
    )

    assert _limits(trajectory) == expected


def test_loading_progression_has_the_existing_ten_percent_ceiling(monkeypatch):
    monkeypatch.setitem(
        session_trajectory._APPROACH_LOADING_RATES, "kaio_path", Decimal("0.25")
    )

    trajectory = SessionTrajectoryPolicy().calculate(
        Decimal("10"), 100, "kaio_path", _weeks("loading", "taper", "taper")
    )

    assert _limits(trajectory)[0] == (Decimal("11.00"), 110)


def test_caps_round_down_and_outputs_are_immutable():
    trajectory = SessionTrajectoryPolicy().calculate(
        Decimal("1.005"), 101, "kaio_path", _weeks("loading", "taper", "taper")
    )

    assert _limits(trajectory)[0] == (Decimal("1.03"), 104)
    assert isinstance(trajectory.weeks, tuple)
    with pytest.raises(FrozenInstanceError):
        trajectory.weeks = ()
    with pytest.raises(FrozenInstanceError):
        trajectory.weeks[0].maximum_longest_outing_duration_minutes = 0


@pytest.mark.parametrize(
    ("distance", "duration", "error"),
    [
        (Decimal("0"), 1, "inconsistent_baseline_longest_outing"),
        (Decimal("1"), 0, "inconsistent_baseline_longest_outing"),
        (True, 10, "invalid_baseline_longest_outing_kilometers"),
        (1.0, 10, "invalid_baseline_longest_outing_kilometers"),
        ("1", 10, "invalid_baseline_longest_outing_kilometers"),
        (Decimal("NaN"), 10, "invalid_baseline_longest_outing_kilometers"),
        (Decimal("-1"), 10, "invalid_baseline_longest_outing_kilometers"),
        (Decimal("1"), True, "invalid_baseline_longest_outing_duration_minutes"),
        (Decimal("1"), 1.5, "invalid_baseline_longest_outing_duration_minutes"),
        (Decimal("1"), -1, "invalid_baseline_longest_outing_duration_minutes"),
    ],
)
def test_rejects_invalid_or_inconsistent_baseline_pairs(distance, duration, error):
    with pytest.raises(ValueError, match=error):
        SessionTrajectoryPolicy().calculate(
            distance, duration, "kaio_path", _weeks("taper")
        )


@pytest.mark.parametrize("approach", [None, True, [], "unknown", "mode-z"])
def test_rejects_unsupported_approaches(approach):
    with pytest.raises(ValueError, match="unsupported_trajectory_approach"):
        SessionTrajectoryPolicy().calculate(
            Decimal("1"), 10, approach, _weeks("taper")
        )


@pytest.mark.parametrize(
    ("distance", "duration", "phases"),
    [
        (Decimal("1"), 10, ("loading",)),
        (Decimal("1"), 10, ("taper", "loading")),
        (0, 0, ("recovery", "taper", "taper")),
        (Decimal("1"), 10, ("loading", "recovery", "loading", "taper", "taper")),
        (
            Decimal("1"),
            10,
            ("loading", "loading", "loading", "loading", "taper", "taper"),
        ),
    ],
)
def test_rejects_sliced_or_malformed_full_horizon_shapes(distance, duration, phases):
    with pytest.raises(ValueError, match="invalid_projected_week_phases"):
        SessionTrajectoryPolicy().calculate(
            distance, duration, "kaio_path", _weeks(*phases)
        )


@pytest.mark.parametrize(
    "weeks",
    [
        [],
        (),
        (ProjectedWeek(2, "taper", Decimal("1")),),
        (ProjectedWeek(1, "unknown", Decimal("1")),),
        (ProjectedWeek(1, "taper", Decimal("NaN")),),
        (ProjectedWeek(1, "taper", Decimal("-1")),),
        (ProjectedWeek(1, "taper", Decimal("0")),),
        (ProjectedWeek(1, "taper", 1.0),),
    ],
)
def test_rejects_invalid_projected_weeks(weeks):
    with pytest.raises(ValueError, match="invalid_projected_weeks"):
        SessionTrajectoryPolicy().calculate(
            Decimal("1"), 10, "kaio_path", weeks
        )
