"""Contextual integrity checks for provider-generated training blocks."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from app.modules.planning.domain import Approach, ProjectedWeek
from app.modules.planning.generation_contract import GeneratedTrainingBlock


@dataclass(frozen=True, slots=True)
class GenerationViolation:
    """A deterministic, machine-readable generation contract violation."""

    code: str
    week_number: int | None = None
    expected_week_number: int | None = None
    session_index: int | None = None
    actual_kilometers: Decimal | None = None
    expected_kilometers: Decimal | None = None


def validate_generated_training_block(
    block: GeneratedTrainingBlock,
    authorized_approach: Approach,
    generation_window_start: date,
    goal_date: date,
    expected_projected_weeks: Sequence[ProjectedWeek],
) -> tuple[GenerationViolation, ...]:
    """Return all independently observable contextual integrity violations.

    The caller is responsible for validating provider payload structure and for
    authorizing the approach. This function only compares that trusted context with
    the generated block.
    """
    violations: list[GenerationViolation] = []
    expected_weeks = tuple(expected_projected_weeks)

    if goal_date < generation_window_start:
        violations.append(GenerationViolation("goal_before_window_start"))

    if not 1 <= len(expected_weeks) <= 4:
        violations.append(GenerationViolation("invalid_expected_projection_count"))

    expected_numbers = tuple(week.week_number for week in expected_weeks)
    if any(number <= 0 for number in expected_numbers):
        violations.append(GenerationViolation("invalid_projected_week_number"))
    if len(set(expected_numbers)) != len(expected_numbers):
        violations.append(GenerationViolation("duplicate_projected_week_number"))
    if any(
        current < previous
        for previous, current in zip(expected_numbers, expected_numbers[1:])
    ):
        violations.append(GenerationViolation("out_of_order_projected_weeks"))

    if block.applied_approach != authorized_approach:
        violations.append(GenerationViolation("applied_approach_mismatch"))

    if len(block.weeks) != len(expected_weeks):
        violations.append(GenerationViolation("generated_week_count_mismatch"))

    for position, generated_week in enumerate(block.weeks):
        projected_week = (
            expected_weeks[position] if position < len(expected_weeks) else None
        )
        if (
            projected_week is not None
            and generated_week.week_number != projected_week.week_number
        ):
            violations.append(
                GenerationViolation(
                    "generated_week_number_mismatch",
                    week_number=generated_week.week_number,
                    expected_week_number=projected_week.week_number,
                )
            )

        week_start = generation_window_start + timedelta(days=position * 7)
        week_end = week_start + timedelta(days=6)
        for session_index, generated_session in enumerate(generated_week.sessions):
            if generated_session.scheduled_date < week_start:
                violations.append(
                    GenerationViolation(
                        "session_before_week_window",
                        week_number=generated_week.week_number,
                        session_index=session_index,
                    )
                )
            elif generated_session.scheduled_date > week_end:
                violations.append(
                    GenerationViolation(
                        "session_after_week_window",
                        week_number=generated_week.week_number,
                        session_index=session_index,
                    )
                )

            if generated_session.scheduled_date > goal_date:
                violations.append(
                    GenerationViolation(
                        "session_after_goal_date",
                        week_number=generated_week.week_number,
                        session_index=session_index,
                    )
                )

        if projected_week is not None:
            actual_running_kilometers = sum(
                (
                    generated_session.planned_distance_kilometers
                    for generated_session in generated_week.sessions
                    if generated_session.session_category == "run"
                ),
                Decimal("0"),
            )
            if actual_running_kilometers != projected_week.estimated_kilometers:
                violations.append(
                    GenerationViolation(
                        "weekly_running_distance_mismatch",
                        week_number=generated_week.week_number,
                        expected_week_number=projected_week.week_number,
                        actual_kilometers=actual_running_kilometers,
                        expected_kilometers=projected_week.estimated_kilometers,
                    )
                )

    return tuple(violations)
