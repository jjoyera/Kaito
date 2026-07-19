from datetime import date
from decimal import Decimal

import pytest

from app.modules.planning.domain import ProjectedWeek
from app.modules.planning.generation_contract import GeneratedTrainingBlock
from app.modules.planning.generation_validator import validate_generated_training_block


def session(
    scheduled_date: str,
    distance: str,
    *,
    category: str = "run",
    session_type: str = "Easy run",
) -> dict:
    duration = 30
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


def codes(result) -> tuple[str, ...]:
    return tuple(violation.code for violation in result)


def test_accepts_valid_one_week_block():
    result = validate_generated_training_block(
        block([(1, [session("2026-08-03", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 9),
        projected((1, "10.00")),
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
    )

    assert codes(result) == (
        "generated_week_count_mismatch",
        "session_after_goal_date",
    )
    assert result[-1].week_number == 2
    assert result[-1].session_index == 0


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
    )

    assert expected_code in codes(result)


def test_short_horizon_rejects_sessions_after_goal_even_inside_week_window():
    result = validate_generated_training_block(
        block([(1, [session("2026-08-06", "10.00")])]),
        "mode_z",
        date(2026, 8, 3),
        date(2026, 8, 5),
        projected((1, "10.00")),
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
    )

    assert expected_code in codes(result)


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
    )
