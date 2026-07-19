"""Pure deterministic sports policy for generated training blocks."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from app.modules.planning.domain import ProjectionPhase
from app.modules.planning.generation_contract import (
    GeneratedTrainingBlock,
    GeneratedTrainingSession,
)
from app.modules.planning.readiness_calendar import ReadinessWeekRole
from app.modules.planning.readiness_capacity import ReadinessCapacityStatus

ELEVATION_POLICY_OUTSIDE_MVP = "outside_mvp_safety_guarantees"
_MINIMUM_LOW_PERCENT = 75
_MAXIMUM_HIGH_PERCENT = 10
_MAXIMUM_THRESHOLD_AND_HIGH_PERCENT = 25
_MINIMUM_STRENGTH_MINUTES = 20
_STRENGTH_MINIMUM_REMOVING_RESTRICTIONS = frozenset(
    {"no_demanding_sessions", "favor_recovery_rest_or_gentle_activity"}
)


@dataclass(frozen=True, slots=True)
class GenerationViolation:
    """A deterministic, machine-readable generated-block violation."""

    code: str
    week_number: int | None = None
    expected_week_number: int | None = None
    session_index: int | None = None
    actual_kilometers: Decimal | None = None
    expected_kilometers: Decimal | None = None
    scheduled_date: date | None = None
    weekday: str | None = None
    actual_minutes: int | None = None
    expected_minutes: int | None = None
    actual_count: int | None = None
    expected_count: int | None = None
    phase: ProjectionPhase | None = None
    expected_phase: ProjectionPhase | None = None


@dataclass(frozen=True, slots=True)
class GeneratedBlockPolicyWeekContext:
    """Trusted phase and readiness role for one generated week position."""

    week_number: int
    projection_phase: ProjectionPhase
    readiness_role: ReadinessWeekRole


@dataclass(frozen=True, slots=True)
class GeneratedBlockPolicyContext:
    """Smallest trusted context needed by the generated sports policy."""

    weeks: tuple[GeneratedBlockPolicyWeekContext, ...]
    readiness_status: ReadinessCapacityStatus
    safety_restriction_codes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class GeneratedBlockPolicyMetadata:
    """Immutable policy declarations that do not imply a safety budget."""

    elevation_policy: Literal["outside_mvp_safety_guarantees"] = (
        ELEVATION_POLICY_OUTSIDE_MVP
    )


@dataclass(frozen=True, slots=True)
class GeneratedBlockPolicyResult:
    """Immutable deterministic policy metadata and ordered violations."""

    metadata: GeneratedBlockPolicyMetadata
    violations: tuple[GenerationViolation, ...]


def validate_generated_block_policy(
    block: GeneratedTrainingBlock,
    context: GeneratedBlockPolicyContext,
) -> GeneratedBlockPolicyResult:
    """Validate sports policy without interpreting generated prose.

    Violation order is intensity, strength by week, then demanding restrictions by
    week and session. Elevation is metadata only and is never treated as a safe
    budget by this policy.
    """
    violations = list(_policy_context_violations(block, context))
    if violations:
        return GeneratedBlockPolicyResult(
            metadata=GeneratedBlockPolicyMetadata(), violations=tuple(violations)
        )

    _validate_intensity(block, violations)
    _validate_strength(block, context, violations)
    _validate_demanding_sessions(block, context, violations)
    return GeneratedBlockPolicyResult(
        metadata=GeneratedBlockPolicyMetadata(), violations=tuple(violations)
    )


def _policy_context_violations(
    block: GeneratedTrainingBlock,
    context: GeneratedBlockPolicyContext,
) -> tuple[GenerationViolation, ...]:
    violations: list[GenerationViolation] = []
    context_week_numbers = tuple(week.week_number for week in context.weeks)
    if len(context.weeks) != len(block.weeks):
        violations.append(
            GenerationViolation(
                "policy_context_week_count_mismatch",
                actual_count=len(context.weeks),
                expected_count=len(block.weeks),
            )
        )
    if len(set(context_week_numbers)) != len(context_week_numbers):
        violations.append(
            GenerationViolation("policy_context_duplicate_week_number")
        )
    if any(
        current < previous
        for previous, current in zip(
            context_week_numbers, context_week_numbers[1:]
        )
    ):
        violations.append(GenerationViolation("policy_context_out_of_order_weeks"))

    for generated_week, context_week in zip(block.weeks, context.weeks):
        if context_week.week_number != generated_week.week_number:
            violations.append(
                GenerationViolation(
                    "policy_context_week_number_mismatch",
                    week_number=context_week.week_number,
                    expected_week_number=generated_week.week_number,
                )
            )
    return tuple(violations)


def _validate_intensity(
    block: GeneratedTrainingBlock, violations: list[GenerationViolation]
) -> None:
    low_minutes = 0
    threshold_minutes = 0
    high_minutes = 0
    for week in block.weeks:
        for session in week.sessions:
            if session.session_category != "run":
                continue
            for segment in session.intensity_segments:
                if segment.intensity_band == "low":
                    low_minutes += segment.duration_minutes
                elif segment.intensity_band == "threshold":
                    threshold_minutes += segment.duration_minutes
                else:
                    high_minutes += segment.duration_minutes

    total_minutes = low_minutes + threshold_minutes + high_minutes
    if total_minutes == 0:
        return
    if low_minutes * 100 < total_minutes * _MINIMUM_LOW_PERCENT:
        violations.append(GenerationViolation("intensity_low_share_below_minimum"))
    if high_minutes * 100 > total_minutes * _MAXIMUM_HIGH_PERCENT:
        violations.append(GenerationViolation("intensity_high_share_above_maximum"))
    if (
        threshold_minutes + high_minutes
    ) * 100 > total_minutes * _MAXIMUM_THRESHOLD_AND_HIGH_PERCENT:
        violations.append(
            GenerationViolation(
                "intensity_threshold_and_high_share_above_maximum"
            )
        )


def _validate_strength(
    block: GeneratedTrainingBlock,
    context: GeneratedBlockPolicyContext,
    violations: list[GenerationViolation],
) -> None:
    restrictions = frozenset(context.safety_restriction_codes)
    minimum_removed = bool(
        restrictions.intersection(_STRENGTH_MINIMUM_REMOVING_RESTRICTIONS)
    )
    for position, week in enumerate(block.weeks):
        week_context = (
            context.weeks[position] if position < len(context.weeks) else None
        )
        strength_sessions = tuple(
            (session_index, session)
            for session_index, session in enumerate(week.sessions)
            if session.session_category == "strength"
        )
        for session_index, session in strength_sessions:
            if session.planned_duration_minutes < _MINIMUM_STRENGTH_MINUTES:
                violations.append(
                    GenerationViolation(
                        "strength_session_duration_below_minimum",
                        week_number=week.week_number,
                        session_index=session_index,
                        actual_minutes=session.planned_duration_minutes,
                        expected_minutes=_MINIMUM_STRENGTH_MINUTES,
                    )
                )

        if len(strength_sessions) > 1:
            violations.append(
                GenerationViolation(
                    "strength_session_frequency_above_maximum",
                    week_number=week.week_number,
                    actual_count=len(strength_sessions),
                    expected_count=1,
                )
            )

        requires_strength = (
            week_context is not None
            and (
                week_context.projection_phase == "loading"
                or week_context.readiness_role in {"build", "peak"}
            )
            and not minimum_removed
        )
        qualifying_count = sum(
            session.planned_duration_minutes >= _MINIMUM_STRENGTH_MINUTES
            for _, session in strength_sessions
        )
        if requires_strength and qualifying_count == 0:
            violations.append(
                GenerationViolation(
                    "strength_session_frequency_below_minimum",
                    week_number=week.week_number,
                    actual_count=qualifying_count,
                    expected_count=1,
                )
            )


def _validate_demanding_sessions(
    block: GeneratedTrainingBlock,
    context: GeneratedBlockPolicyContext,
    violations: list[GenerationViolation],
) -> None:
    restrictions = frozenset(context.safety_restriction_codes)
    taper_demanding_seen = 0
    for position, week in enumerate(block.weeks):
        week_context = (
            context.weeks[position] if position < len(context.weeks) else None
        )
        is_recovery = week_context is not None and (
            week_context.projection_phase == "recovery"
            or week_context.readiness_role == "recovery"
        )
        is_taper = week_context is not None and (
            week_context.projection_phase == "taper"
            or week_context.readiness_role == "taper"
        )
        for session_index, session in enumerate(week.sessions):
            demanding = _is_demanding(session)
            if demanding and is_recovery:
                violations.append(
                    _session_violation(
                        "demanding_session_forbidden_in_recovery_week",
                        week.week_number,
                        session_index,
                    )
                )
            if demanding and context.readiness_status == "not_feasible":
                violations.append(
                    _session_violation(
                        "demanding_session_forbidden_by_readiness",
                        week.week_number,
                        session_index,
                    )
                )
            if demanding and "no_demanding_sessions" in restrictions:
                violations.append(
                    _session_violation(
                        "demanding_session_forbidden_by_restriction",
                        week.week_number,
                        session_index,
                    )
                )
            if (
                "reduce_demanding_session_intensity_or_duration" in restrictions
                and _exceeds_reduced_demanding_limit(session)
            ):
                violations.append(
                    _session_violation(
                        "demanding_session_exceeds_reduced_limit",
                        week.week_number,
                        session_index,
                    )
                )
            if demanding and is_taper:
                taper_demanding_seen += 1
                if taper_demanding_seen > 1:
                    violations.append(
                        _session_violation(
                            "taper_demanding_session_limit_exceeded",
                            week.week_number,
                            session_index,
                        )
                    )


def _is_demanding(session: GeneratedTrainingSession) -> bool:
    has_high = any(
        segment.intensity_band == "high" for segment in session.intensity_segments
    )
    has_threshold = any(
        segment.intensity_band == "threshold"
        for segment in session.intensity_segments
    )
    return (
        has_high
        or (has_threshold and session.is_key_session)
        or session.target_rpe_max >= 8
        or (session.is_key_session and session.target_rpe_max >= 7)
    )


def _exceeds_reduced_demanding_limit(session: GeneratedTrainingSession) -> bool:
    return (
        any(
            segment.intensity_band == "high"
            for segment in session.intensity_segments
        )
        or session.is_key_session
        or session.target_rpe_max >= 8
    )


def _session_violation(
    code: str, week_number: int, session_index: int
) -> GenerationViolation:
    return GenerationViolation(
        code, week_number=week_number, session_index=session_index
    )
