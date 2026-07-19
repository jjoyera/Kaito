from datetime import date
from decimal import Decimal

import pytest

from app.modules.planning.domain import ProjectedWeek
from app.modules.planning.generation_contract import GeneratedTrainingBlock
from app.modules.planning.generation_validator import validate_generated_training_block
from app.modules.planning.session_trajectory import (
    SessionTrajectory,
    SessionTrajectoryWeek,
)
from app.modules.runner_profile.domain import WeeklyAvailability


def session(
    scheduled_date: str,
    distance: str,
    *,
    category: str = "run",
    session_type: str = "Easy run",
    duration: int = 30,
) -> dict:
    return {
        "scheduled_date": scheduled_date,
        "session_type": session_type,
        "session_category": category,
        "planned_duration_minutes": duration,
        "planned_distance_kilometers": distance,
        "planned_elevation_meters": 0,
        "intensity_description": "Easy",
        "intensity_segments": (
            [{"duration_minutes": duration, "intensity_band": "low"}]
            if category == "run"
            else []
        ),
        "target_rpe_min": 2,
        "target_rpe_max": 3,
        "is_key_session": False,
        "purpose": "Build consistency",
        "instructions": "Keep it easy",
    }


def block(
    weeks: list[tuple[int, list[dict]]], *, approach: str = "mode_z"
) -> GeneratedTrainingBlock:
    return GeneratedTrainingBlock.model_validate(
        {
            "applied_approach": approach,
            "block_focus": "Aerobic development",
            "weeks": [
                {"week_number": number, "week_goal": "Consistency", "sessions": items}
                for number, items in weeks
            ],
            "coach_advice": "Recover well",
        }
    )


def projected(*weeks: tuple[int, str]) -> tuple[ProjectedWeek, ...]:
    return tuple(
        ProjectedWeek(number, "loading", Decimal(kilometers))
        for number, kilometers in weeks
    )


def trajectory(
    *weeks: tuple[int, str, str, int],
) -> SessionTrajectory:
    return SessionTrajectory(
        tuple(
            SessionTrajectoryWeek(number, phase, Decimal(kilometers), minutes)
            for number, phase, kilometers, minutes in weeks
        )
    )


def trajectory_matching_projection(
    expected: tuple[ProjectedWeek, ...], maximum_duration_minutes: int
) -> SessionTrajectory:
    return SessionTrajectory(
        tuple(
            SessionTrajectoryWeek(
                week.week_number,
                week.phase,
                week.estimated_kilometers,
                maximum_duration_minutes,
            )
            for week in expected
        )
    )


def codes(result) -> tuple[str, ...]:
    return tuple(violation.code for violation in result)


FULL_WEEK_AVAILABILITY = WeeklyAvailability(
    {
        "monday": 300,
        "tuesday": 300,
        "wednesday": 300,
        "thursday": 300,
        "friday": 300,
        "saturday": 300,
        "sunday": 300,
    }
)


def test_rejects_training_on_an_unavailable_weekday_with_date_metadata():
    result = validate_generated_training_block(
        block([(1, [session("2026-08-04", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        WeeklyAvailability({"monday": 60}),
        trajectory((1, "loading", "10.00", 30)),
    )

    assert codes(result) == ("training_on_unavailable_weekday",)
    assert result[0].scheduled_date == date(2026, 8, 4)
    assert result[0].weekday == "tuesday"
    assert result[0].actual_minutes == 30
    assert result[0].expected_minutes == 0


def test_aggregates_same_date_duration_across_unexpected_extra_weeks():
    result = validate_generated_training_block(
        block(
            [
                (1, [session("2026-08-03", "4.00", duration=30)]),
                (2, [session("2026-08-03", "6.00", duration=20)]),
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "4.00")),
        WeeklyAvailability({"monday": 45}),
        trajectory((1, "loading", "4.00", 30)),
    )

    assert codes(result) == (
        "generated_week_count_mismatch",
        "session_before_week_window",
        "missing_session_trajectory_limit",
        "daily_availability_exceeded",
    )
    assert result[-1].scheduled_date == date(2026, 8, 3)
    assert result[-1].weekday == "monday"
    assert result[-1].actual_minutes == 50
    assert result[-1].expected_minutes == 45


@pytest.mark.parametrize(
    ("available_minutes", "expected_codes"),
    [(50, ()), (49, ("daily_availability_exceeded",))],
)
def test_daily_capacity_aggregates_all_session_categories_and_allows_exact_limit(
    available_minutes, expected_codes
):
    result = validate_generated_training_block(
        block(
            [
                (
                    1,
                    [
                        session("2026-08-03", "10.00", duration=30),
                        session(
                            "2026-08-03",
                            "0",
                            category="strength",
                            session_type="Gym",
                            duration=20,
                        ),
                    ],
                )
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        WeeklyAvailability({"monday": available_minutes}),
        trajectory((1, "loading", "10.00", 30)),
    )

    assert codes(result) == expected_codes
    if result:
        assert result[0].actual_minutes == 50
        assert result[0].expected_minutes == available_minutes


def test_availability_violations_are_ordered_by_calendar_date_not_payload_order():
    result = validate_generated_training_block(
        block(
            [
                (
                    1,
                    [
                        session("2026-08-04", "4.00"),
                        session("2026-08-03", "6.00"),
                    ],
                )
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        WeeklyAvailability({"monday": 15}),
        trajectory((1, "loading", "6.00", 30)),
    )

    assert codes(result) == (
        "daily_availability_exceeded",
        "training_on_unavailable_weekday",
    )
    assert tuple(violation.scheduled_date for violation in result) == (
        date(2026, 8, 3),
        date(2026, 8, 4),
    )


def test_accepts_valid_one_week_block():
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "10.00", 30)),
    )

    assert result == ()


def test_accepts_valid_four_week_block_and_arbitrary_weeks_five_to_eight():
    result = validate_generated_training_block(
        block(
            [
                (5, [session("2026-08-03", "10.00")]),
                (6, [session("2026-08-10", "11.00")]),
                (7, [session("2026-08-17", "12.00")]),
                (8, [session("2026-08-24", "13.00")]),
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 30),
        projected((5, "10.00"), (6, "11.00"), (7, "12.00"), (8, "13.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory(
            (5, "loading", "10.00", 30),
            (6, "loading", "11.00", 30),
            (7, "loading", "12.00", 30),
            (8, "loading", "13.00", 30),
        ),
    )

    assert result == ()


def test_reports_approach_count_and_week_correspondence_mismatches():
    result = validate_generated_training_block(
        block(
            [
                (5, [session("2026-08-03", "10.00")]),
                (7, [session("2026-08-10", "11.00")]),
            ],
            approach="kaio_path",
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 30),
        projected((5, "10.00"), (6, "11.00"), (7, "12.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory(
            (5, "loading", "10.00", 30),
            (6, "loading", "11.00", 30),
            (7, "loading", "12.00", 30),
        ),
    )

    assert codes(result) == (
        "applied_approach_mismatch",
        "generated_week_count_mismatch",
        "generated_week_number_mismatch",
    )
    assert result[-1].week_number == 7
    assert result[-1].expected_week_number == 6


def test_extra_generated_week_still_reports_independent_date_violations():
    result = validate_generated_training_block(
        block(
            [
                (1, [session("2026-08-03", "10.00")]),
                (2, [session("2026-08-10", "4.00")]),
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "10.00", 30)),
    )

    assert codes(result) == (
        "generated_week_count_mismatch",
        "session_after_goal_date",
        "missing_session_trajectory_limit",
    )
    assert result[1].week_number == 2
    assert result[1].session_index == 0


@pytest.mark.parametrize(
    ("scheduled_date", "expected_code"),
    [
        ("2026-08-02", "session_before_week_window"),
        ("2026-08-10", "session_after_week_window"),
    ],
)
def test_rejects_sessions_outside_their_corresponding_week(
    scheduled_date, expected_code
):
    result = validate_generated_training_block(
        block([(5, [session(scheduled_date, "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 20),
        projected((5, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((5, "loading", "10.00", 30)),
    )

    assert expected_code in codes(result)


def test_short_horizon_rejects_sessions_after_goal_even_inside_week_window():
    result = validate_generated_training_block(
        block([(1, [session("2026-08-06", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 5),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "10.00", 30)),
    )

    assert codes(result) == ("session_after_goal_date",)


@pytest.mark.parametrize("actual", ["9.99", "10.01"])
def test_rejects_running_distance_under_or_over_projection_by_point_zero_one(actual):
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", actual)])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", actual, 30)),
    )

    assert codes(result) == ("weekly_running_distance_mismatch",)
    assert result[0].actual_kilometers == Decimal(actual)
    assert result[0].expected_kilometers == Decimal("10.00")


def test_exact_running_sum_excludes_strength_and_cross_training_distance():
    result = validate_generated_training_block(
        block(
            [
                (
                    1,
                    [
                        session("2026-08-03", "4.25"),
                        session("2026-08-05", "5.75"),
                        session(
                            "2026-08-04",
                            "3.00",
                            category="strength",
                            session_type="Gym",
                        ),
                        session(
                            "2026-08-06",
                            "20.00",
                            category="cross_training",
                            session_type="Bike",
                        ),
                    ],
                )
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "5.75", 30)),
    )

    assert result == ()


def test_allows_multiple_sessions_on_the_same_day():
    result = validate_generated_training_block(
        block(
            [
                (
                    1,
                    [
                        session("2026-08-03", "4.00"),
                        session("2026-08-03", "6.00"),
                    ],
                )
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "6.00", 30)),
    )

    assert result == ()


@pytest.mark.parametrize(
    ("goal", "expected", "expected_codes"),
    [
        (date(2026, 8, 2), projected((1, "10.00")), ("goal_before_window_start",)),
        (date(2026, 8, 9), (), ("invalid_expected_projection_count",)),
        (
            date(2026, 8, 9),
            projected(
                (1, "10.00"),
                (2, "10.00"),
                (3, "10.00"),
                (4, "10.00"),
                (5, "10.00"),
            ),
            ("invalid_expected_projection_count",),
        ),
    ],
)
def test_reports_invalid_context(goal, expected, expected_codes):
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        goal,
        expected,
        FULL_WEEK_AVAILABILITY,
        trajectory_matching_projection(expected, 30),
    )

    assert codes(result)[: len(expected_codes)] == expected_codes


@pytest.mark.parametrize(
    ("expected", "expected_code"),
    [
        (projected((5, "10.00"), (5, "10.00")), "duplicate_projected_week_number"),
        (projected((6, "10.00"), (5, "10.00")), "out_of_order_projected_weeks"),
    ],
)
def test_reports_duplicate_and_out_of_order_projected_week_numbers(
    expected, expected_code
):
    result = validate_generated_training_block(
        block(
            [
                (expected[0].week_number, [session("2026-08-03", "10.00")]),
                (expected[1].week_number, [session("2026-08-10", "10.00")]),
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 16),
        expected,
        FULL_WEEK_AVAILABILITY,
        trajectory_matching_projection(expected, 30),
    )

    assert expected_code in codes(result)


def test_rejects_run_session_over_both_independent_trajectory_caps_in_order():
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", "10.00", duration=61)])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "9.99", 60)),
    )

    assert codes(result) == (
        "session_trajectory_distance_exceeded",
        "session_trajectory_duration_exceeded",
    )
    assert result[0].week_number == 1
    assert result[0].expected_week_number == 1
    assert result[0].session_index == 0
    assert result[0].actual_kilometers == Decimal("10.00")
    assert result[0].expected_kilometers == Decimal("9.99")
    assert result[1].actual_minutes == 61
    assert result[1].expected_minutes == 60


@pytest.mark.parametrize(
    ("distance", "duration", "distance_cap", "duration_cap", "expected_code"),
    [
        ("10.00", 30, "9.99", 60, "session_trajectory_distance_exceeded"),
        ("10.00", 61, "10.00", 60, "session_trajectory_duration_exceeded"),
    ],
)
def test_enforces_distance_and_duration_caps_without_coupling_them(
    distance, duration, distance_cap, duration_cap, expected_code
):
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", distance, duration=duration)])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, distance)),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", distance_cap, duration_cap)),
    )

    assert codes(result) == (expected_code,)


def test_allows_run_session_at_both_exact_trajectory_caps():
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", "10.00", duration=60)])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "10.00", 60)),
    )

    assert result == ()


def test_does_not_apply_running_trajectory_caps_to_non_running_sessions():
    result = validate_generated_training_block(
        block(
            [
                (
                    1,
                    [
                        session("2026-08-03", "10.00"),
                        session(
                            "2026-08-04",
                            "99.00",
                            category="cross_training",
                            session_type="Bike",
                            duration=240,
                        ),
                    ],
                )
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "10.00", 60)),
    )

    assert result == ()


def test_uses_positional_trajectory_limit_for_malformed_generated_week_number():
    result = validate_generated_training_block(
        block([(99, [session("2026-08-03", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((5, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((5, "loading", "9.00", 30)),
    )

    assert codes(result) == (
        "generated_week_number_mismatch",
        "session_trajectory_distance_exceeded",
    )
    assert result[1].week_number == 99
    assert result[1].expected_week_number == 5


def test_extra_generated_week_fails_closed_without_an_authorized_trajectory_limit():
    result = validate_generated_training_block(
        block(
            [
                (1, [session("2026-08-03", "10.00")]),
                (2, [session("2026-08-10", "1.00")]),
            ]
        ),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 16),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((1, "loading", "10.00", 60)),
    )

    assert codes(result) == (
        "generated_week_count_mismatch",
        "missing_session_trajectory_limit",
    )
    assert result[-1].week_number == 2
    assert result[-1].session_index is None


@pytest.mark.parametrize(
    ("expected_trajectory", "expected_codes"),
    [
        (
            SessionTrajectory(()),
            (
                "trajectory_projection_count_mismatch",
                "missing_session_trajectory_limit",
            ),
        ),
        (
            trajectory((2, "loading", "10.00", 60)),
            ("trajectory_week_number_mismatch",),
        ),
        (
            trajectory((1, "recovery", "10.00", 60)),
            ("trajectory_phase_mismatch",),
        ),
    ],
)
def test_rejects_incoherent_trajectory_context_at_the_boundary(
    expected_trajectory, expected_codes
):
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
        FULL_WEEK_AVAILABILITY,
        expected_trajectory,
    )

    assert codes(result) == expected_codes


def test_trajectory_violations_follow_week_context_and_dates_before_weekly_distance():
    result = validate_generated_training_block(
        block([(2, [session("2026-08-10", "10.00", duration=61)])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "9.00")),
        WeeklyAvailability({"monday": 30}),
        trajectory((1, "loading", "8.00", 60)),
    )

    assert codes(result) == (
        "generated_week_number_mismatch",
        "session_after_week_window",
        "session_after_goal_date",
        "session_trajectory_distance_exceeded",
        "session_trajectory_duration_exceeded",
        "weekly_running_distance_mismatch",
        "daily_availability_exceeded",
    )


def test_collects_independent_violations_in_stable_machine_readable_order():
    result = validate_generated_training_block(
        block(
            [(8, [session("2026-08-12", "9.99")])],
            approach="kaio_path",
        ),
        "mode_z",
        date(2026, 8, 10),
        date(2026, 8, 9),
        projected((7, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((7, "loading", "9.99", 30)),
    )

    assert codes(result) == (
        "goal_before_window_start",
        "applied_approach_mismatch",
        "generated_week_number_mismatch",
        "session_after_goal_date",
        "weekly_running_distance_mismatch",
    )
    assert result == validate_generated_training_block(
        block(
            [(8, [session("2026-08-12", "9.99")])],
            approach="kaio_path",
        ),
        "mode_z",
        date(2026, 8, 10),
        date(2026, 8, 9),
        projected((7, "10.00")),
        FULL_WEEK_AVAILABILITY,
        trajectory((7, "loading", "9.99", 30)),
    )
