"""Contextual integrity checks for provider-generated training blocks."""

from collections.abc import Sequence
from datetime import date, timedelta
from decimal import Decimal

from app.modules.planning.domain import Approach, ProjectedWeek
from app.modules.planning.generated_block_policy import (
    GeneratedBlockPolicyContext,
    GenerationViolation,
    validate_generated_block_policy,
)
from app.modules.planning.generation_contract import (
    GeneratedTrainingBlock,
    GeneratedTrainingWeek,
)
from app.modules.planning.session_trajectory import (
    SessionTrajectory,
    SessionTrajectoryWeek,
)
from app.modules.runner_profile.domain import WeeklyAvailability

_WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


def validate_generated_training_block(
    block: GeneratedTrainingBlock,
    authorized_approach: Approach,
    generation_window_start: date,
    goal_date: date,
    expected_projected_weeks: Sequence[ProjectedWeek],
    weekly_availability: WeeklyAvailability,
    expected_session_trajectory: SessionTrajectory,
    policy_context: GeneratedBlockPolicyContext,
) -> tuple[GenerationViolation, ...]:
    """Return all independently observable contextual integrity violations.

    The caller is responsible for validating provider payload structure and for
    authorizing the approach. Availability and the backend-computed session
    trajectory are mandatory safety context; this function compares all trusted
    context with the generated block.
    """
    violations: list[GenerationViolation] = []
    expected_weeks = tuple(expected_projected_weeks)
    trajectory_weeks = expected_session_trajectory.weeks

    _validate_context(
        generation_window_start,
        goal_date,
        expected_weeks,
        trajectory_weeks,
        violations,
    )
    _validate_approach_and_count(
        block, authorized_approach, expected_weeks, violations
    )

    for position, generated_week in enumerate(block.weeks):
        projected_week = (
            expected_weeks[position] if position < len(expected_weeks) else None
        )
        trajectory_week = (
            trajectory_weeks[position] if position < len(trajectory_weeks) else None
        )
        _validate_week_correspondence(generated_week, projected_week, violations)
        _validate_session_date_windows(
            generated_week,
            position,
            generation_window_start,
            goal_date,
            violations,
        )
        _validate_session_trajectory(generated_week, trajectory_week, violations)
        _validate_weekly_running_distance(
            generated_week, projected_week, violations
        )

    _validate_daily_availability(block, weekly_availability, violations)
    _validate_policy_projection_context(policy_context, expected_weeks, violations)

    # Sports-policy violations are appended after the established contextual order.
    # The pure policy owns its own canonical intensity/strength/demanding ordering.
    violations.extend(validate_generated_block_policy(block, policy_context).violations)

    return tuple(violations)


def _validate_policy_projection_context(
    policy_context: GeneratedBlockPolicyContext,
    expected_weeks: tuple[ProjectedWeek, ...],
    violations: list[GenerationViolation],
) -> None:
    if len(policy_context.weeks) != len(expected_weeks):
        violations.append(
            GenerationViolation(
                "policy_context_projection_count_mismatch",
                actual_count=len(policy_context.weeks),
                expected_count=len(expected_weeks),
            )
        )
    for policy_week, projected_week in zip(policy_context.weeks, expected_weeks):
        if policy_week.week_number != projected_week.week_number:
            violations.append(
                GenerationViolation(
                    "policy_context_projected_week_number_mismatch",
                    week_number=policy_week.week_number,
                    expected_week_number=projected_week.week_number,
                )
            )
        if policy_week.projection_phase != projected_week.phase:
            violations.append(
                GenerationViolation(
                    "policy_context_projection_phase_mismatch",
                    week_number=policy_week.week_number,
                    phase=policy_week.projection_phase,
                    expected_phase=projected_week.phase,
                )
            )


def _validate_context(
    generation_window_start: date,
    goal_date: date,
    expected_weeks: tuple[ProjectedWeek, ...],
    trajectory_weeks: tuple[SessionTrajectoryWeek, ...],
    violations: list[GenerationViolation],
) -> None:
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

    if len(trajectory_weeks) != len(expected_weeks):
        violations.append(GenerationViolation("trajectory_projection_count_mismatch"))

    for position, projected_week in enumerate(expected_weeks):
        if position >= len(trajectory_weeks):
            break
        trajectory_week = trajectory_weeks[position]
        if trajectory_week.week_number != projected_week.week_number:
            violations.append(
                GenerationViolation(
                    "trajectory_week_number_mismatch",
                    week_number=trajectory_week.week_number,
                    expected_week_number=projected_week.week_number,
                )
            )
        if trajectory_week.phase != projected_week.phase:
            violations.append(
                GenerationViolation(
                    "trajectory_phase_mismatch",
                    week_number=trajectory_week.week_number,
                    expected_week_number=projected_week.week_number,
                    phase=trajectory_week.phase,
                    expected_phase=projected_week.phase,
                )
            )


def _validate_approach_and_count(
    block: GeneratedTrainingBlock,
    authorized_approach: Approach,
    expected_weeks: tuple[ProjectedWeek, ...],
    violations: list[GenerationViolation],
) -> None:
    if block.applied_approach != authorized_approach:
        violations.append(GenerationViolation("applied_approach_mismatch"))
    if len(block.weeks) != len(expected_weeks):
        violations.append(GenerationViolation("generated_week_count_mismatch"))


def _validate_week_correspondence(
    generated_week: GeneratedTrainingWeek,
    projected_week: ProjectedWeek | None,
    violations: list[GenerationViolation],
) -> None:
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


def _validate_session_date_windows(
    generated_week: GeneratedTrainingWeek,
    position: int,
    generation_window_start: date,
    goal_date: date,
    violations: list[GenerationViolation],
) -> None:
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


def _validate_daily_availability(
    block: GeneratedTrainingBlock,
    weekly_availability: WeeklyAvailability,
    violations: list[GenerationViolation],
) -> None:
    duration_by_date: dict[date, int] = {}
    for generated_week in block.weeks:
        for generated_session in generated_week.sessions:
            scheduled_date = generated_session.scheduled_date
            duration_by_date[scheduled_date] = (
                duration_by_date.get(scheduled_date, 0)
                + generated_session.planned_duration_minutes
            )

    for scheduled_date, actual_minutes in sorted(duration_by_date.items()):
        weekday = _WEEKDAYS[scheduled_date.weekday()]
        expected_minutes = weekly_availability.minutes_by_day.get(weekday, 0)
        if expected_minutes == 0:
            violations.append(
                GenerationViolation(
                    "training_on_unavailable_weekday",
                    scheduled_date=scheduled_date,
                    weekday=weekday,
                    actual_minutes=actual_minutes,
                    expected_minutes=expected_minutes,
                )
            )
        elif actual_minutes > expected_minutes:
            violations.append(
                GenerationViolation(
                    "daily_availability_exceeded",
                    scheduled_date=scheduled_date,
                    weekday=weekday,
                    actual_minutes=actual_minutes,
                    expected_minutes=expected_minutes,
                )
            )


def _validate_session_trajectory(
    generated_week: GeneratedTrainingWeek,
    trajectory_week: SessionTrajectoryWeek | None,
    violations: list[GenerationViolation],
) -> None:
    if trajectory_week is None:
        violations.append(
            GenerationViolation(
                "missing_session_trajectory_limit",
                week_number=generated_week.week_number,
            )
        )
        return

    for session_index, session in enumerate(generated_week.sessions):
        if session.session_category != "run":
            continue
        if (
            session.planned_distance_kilometers
            > trajectory_week.maximum_longest_outing_kilometers
        ):
            violations.append(
                GenerationViolation(
                    "session_trajectory_distance_exceeded",
                    week_number=generated_week.week_number,
                    expected_week_number=trajectory_week.week_number,
                    session_index=session_index,
                    actual_kilometers=session.planned_distance_kilometers,
                    expected_kilometers=(
                        trajectory_week.maximum_longest_outing_kilometers
                    ),
                )
            )
        if (
            session.planned_duration_minutes
            > trajectory_week.maximum_longest_outing_duration_minutes
        ):
            violations.append(
                GenerationViolation(
                    "session_trajectory_duration_exceeded",
                    week_number=generated_week.week_number,
                    expected_week_number=trajectory_week.week_number,
                    session_index=session_index,
                    actual_minutes=session.planned_duration_minutes,
                    expected_minutes=(
                        trajectory_week.maximum_longest_outing_duration_minutes
                    ),
                )
            )


def _validate_weekly_running_distance(
    generated_week: GeneratedTrainingWeek,
    projected_week: ProjectedWeek | None,
    violations: list[GenerationViolation],
) -> None:
    if projected_week is None:
        return

    actual_running_kilometers = sum(
        (
            session.planned_distance_kilometers
            for session in generated_week.sessions
            if session.session_category == "run"
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
