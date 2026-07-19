"""Synchronous generation of one deterministic, validated training block."""

from collections.abc import Callable
from datetime import datetime

from app.modules.auth.context import UserContext
from app.modules.planning.generated_block_policy import (
    GeneratedBlockPolicyContext,
    GeneratedBlockPolicyWeekContext,
    GenerationViolation,
)
from app.modules.planning.generation_context import (
    TrainingGenerationContext,
    assemble_training_generation_context,
)
from app.modules.planning.generation_contract import GeneratedTrainingBlock
from app.modules.planning.generation_provider import (
    TrainingBlockGenerationProvider,
    TrainingGenerationInvalidResponse,
    TrainingGenerationRefused,
    TrainingGenerationTimeout,
    TrainingGenerationUnavailable,
)
from app.modules.planning.generation_validator import validate_generated_training_block
from app.modules.planning.session_trajectory import SessionTrajectory
from app.modules.planning.use_cases import TrainingPlanTransactionFactory


class GeneratedTrainingBlockRejected(Exception):
    def __init__(self) -> None:
        super().__init__("generation_validation_failed")


_PROVIDER_FAILURES = (
    TrainingGenerationTimeout,
    TrainingGenerationRefused,
    TrainingGenerationInvalidResponse,
    TrainingGenerationUnavailable,
)


def generate_validated_training_block(
    user: UserContext,
    transactions: TrainingPlanTransactionFactory,
    provider: TrainingBlockGenerationProvider,
    *,
    current_instant: Callable[[], datetime],
) -> GeneratedTrainingBlock:
    """Assemble once, then allow one retry only after semantic validation failure."""

    context = assemble_training_generation_context(
        user, transactions, current_instant=current_instant
    )
    for _ in range(2):
        candidate = _generate_candidate(provider, context)
        if not _validation_violations(candidate, context):
            return candidate
    raise GeneratedTrainingBlockRejected()


def _generate_candidate(
    provider: TrainingBlockGenerationProvider,
    context: TrainingGenerationContext,
) -> GeneratedTrainingBlock:
    try:
        candidate = provider.generate(context.provider_context)
    except _PROVIDER_FAILURES:
        raise
    except Exception:
        raise TrainingGenerationUnavailable() from None
    if type(candidate) is not GeneratedTrainingBlock:
        raise TrainingGenerationInvalidResponse() from None
    return candidate


def _validation_violations(
    block: GeneratedTrainingBlock, context: TrainingGenerationContext
) -> tuple[GenerationViolation, ...]:
    generated_week_count = len(context.provider_context.weeks)
    projected_weeks = context.full_projection[:generated_week_count]
    trajectory = SessionTrajectory(
        context.full_session_trajectory.weeks[:generated_week_count]
    )
    policy_context = GeneratedBlockPolicyContext(
        weeks=tuple(
            GeneratedBlockPolicyWeekContext(
                week_number=week.week_number,
                projection_phase=week.phase,
                readiness_role=context.readiness_calendar.weeks[index].role,
            )
            for index, week in enumerate(projected_weeks)
        ),
        readiness_status=context.readiness_capacity.status,
        safety_restriction_codes=(
            context.provider_context.safety.restriction_codes
        ),
    )
    return validate_generated_training_block(
        block,
        context.authorized_approach,
        context.generation_window_start,
        context.goal_date,
        projected_weeks,
        context.weekly_availability,
        trajectory,
        policy_context,
    )
