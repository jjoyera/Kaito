from dataclasses import FrozenInstanceError

import pytest

from app.modules.planning.readiness_calendar import create_readiness_calendar


def _roles(calendar):
    return tuple(week.role for week in calendar.weeks)


@pytest.mark.parametrize(
    ("weeks_until_goal", "required_peak_loading_weeks", "expected_roles"),
    [
        (6, 3, ("peak", "peak", "peak", "recovery", "taper", "taper")),
        (
            9,
            6,
            (
                "peak",
                "peak",
                "peak",
                "recovery",
                "peak",
                "peak",
                "peak",
                "taper",
                "taper",
            ),
        ),
    ],
)
def test_places_confirmed_peak_loading_examples(
    weeks_until_goal, required_peak_loading_weeks, expected_roles
):
    calendar = create_readiness_calendar(
        weeks_until_goal, required_peak_loading_weeks
    )

    assert _roles(calendar) == expected_roles
    assert calendar.is_feasible is True
    assert calendar.missing_peak_loading_weeks == 0


@pytest.mark.parametrize(
    ("weeks_until_goal", "expected_roles", "expected_missing"),
    [
        (1, ("taper",), 1),
        (2, ("taper", "taper"), 1),
    ],
)
def test_short_horizons_preserve_taper(
    weeks_until_goal, expected_roles, expected_missing
):
    calendar = create_readiness_calendar(weeks_until_goal, 1)

    assert _roles(calendar) == expected_roles
    assert calendar.is_feasible is False
    assert calendar.missing_peak_loading_weeks == expected_missing


def test_reports_exact_shortfall_without_converting_recovery_or_taper():
    calendar = create_readiness_calendar(6, 5)

    assert _roles(calendar) == (
        "peak",
        "peak",
        "peak",
        "recovery",
        "taper",
        "taper",
    )
    assert calendar.required_peak_loading_weeks == 5
    assert calendar.available_loading_slots == 3
    assert calendar.assigned_peak_loading_weeks == 3
    assert calendar.missing_peak_loading_weeks == 2
    assert calendar.is_feasible is False


def test_assigns_peak_to_latest_loading_slots_and_leaves_earlier_build_weeks():
    calendar = create_readiness_calendar(12, 4)

    assert _roles(calendar) == (
        "build",
        "build",
        "build",
        "recovery",
        "build",
        "peak",
        "peak",
        "recovery",
        "peak",
        "peak",
        "taper",
        "taper",
    )
    assert calendar.available_loading_slots == 8
    assert calendar.assigned_peak_loading_weeks == 4
    assert calendar.missing_peak_loading_weeks == 0
    assert calendar.is_feasible is True


def test_week_entries_have_stable_one_based_numbering_and_order():
    calendar = create_readiness_calendar(9, 2)

    assert tuple(week.week_number for week in calendar.weeks) == tuple(range(1, 10))
    assert calendar == create_readiness_calendar(9, 2)


def test_calendar_and_week_entries_are_immutable():
    calendar = create_readiness_calendar(6, 3)

    assert isinstance(calendar.weeks, tuple)
    with pytest.raises(FrozenInstanceError):
        calendar.is_feasible = False
    with pytest.raises(FrozenInstanceError):
        calendar.weeks[0].role = "build"


def test_forward_three_plus_one_structure_is_preserved_before_taper():
    calendar = create_readiness_calendar(14, 2)

    recovery_week_numbers = tuple(
        week.week_number for week in calendar.weeks if week.role == "recovery"
    )

    assert recovery_week_numbers == (4, 8, 12)
    assert _roles(calendar)[-2:] == ("taper", "taper")


@pytest.mark.parametrize(
    ("weeks_until_goal", "required_peak_loading_weeks"),
    [
        (True, 1),
        (False, 1),
        (1.0, 1),
        (0, 1),
        (-1, 1),
        (1, True),
        (1, False),
        (1, 1.0),
        (1, 0),
        (1, -1),
    ],
)
def test_rejects_non_integer_or_non_positive_inputs(
    weeks_until_goal, required_peak_loading_weeks
):
    with pytest.raises(ValueError):
        create_readiness_calendar(weeks_until_goal, required_peak_loading_weeks)
