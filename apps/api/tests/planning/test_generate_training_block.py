from contextlib import contextmanager
from datetime import UTC, datetime

import pytest

from app.modules.auth.context import UserContext
from app.modules.planning.generated_block_policy import (
    GeneratedBlockPolicyContext,
    GeneratedBlockPolicyWeekContext,
)
from app.modules.planning.generation_context import (
    assemble_training_generation_context,
)
from app.modules.planning.generation_contract import GeneratedTrainingBlock
from app.modules.planning.generation_provider import (
    TrainingGenerationInvalidResponse,
    TrainingGenerationRefused,
    TrainingGenerationTimeout,
    TrainingGenerationUnavailable,
)
from app.modules.planning.generation_use_case import (
    GeneratedTrainingBlockRejected,
    generate_validated_training_block,
)
from app.modules.planning.generation_validator import validate_generated_training_block
from app.modules.planning.session_trajectory import SessionTrajectory
from tests.planning.test_approach_eligibility import eligible_snapshot


class Repository:
    def __init__(self) -> None:
        snapshot = eligible_snapshot(target_date="2026-07-08")
        snapshot["goal"]["target_date"] = "2026-07-08"
        self.source = {"plan_approach": "kaio_path", "snapshot": snapshot}
        self.reads = 0

    def read_generation_source(self, owner_id):
        self.reads += 1
        return self.source


class Transactions:
    def __init__(self, repository: Repository) -> None:
        self.repository = repository
        self.entries = 0
        self.active = False

    @contextmanager
    def __call__(self, user):
        self.entries += 1
        self.active = True
        try:
            yield self.repository
        finally:
            self.active = False


class Provider:
    def __init__(self, outcomes, transactions: Transactions) -> None:
        self.outcomes = iter(outcomes)
        self.transactions = transactions
        self.contexts = []

    def generate(self, context):
        assert self.transactions.active is False
        self.contexts.append(context)
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def candidate(*, approach: str = "kaio_path") -> GeneratedTrainingBlock:
    def run(day: str) -> dict[str, object]:
        return {
            "scheduled_date": day,
            "session_type": "Easy run",
            "session_category": "run",
            "planned_duration_minutes": 30,
            "planned_distance_kilometers": "7.50",
            "planned_elevation_meters": 0,
            "intensity_description": "Easy",
            "intensity_segments": [{"duration_minutes": 30, "intensity_band": "low"}],
            "target_rpe_min": 2,
            "target_rpe_max": 3,
            "is_key_session": False,
            "purpose": "Build consistency",
            "instructions": "Keep it easy",
        }

    return GeneratedTrainingBlock.model_validate(
        {
            "applied_approach": approach,
            "block_focus": "Aerobic consistency",
            "weeks": [
                {
                    "week_number": 1,
                    "week_goal": "Consistency",
                    "sessions": [run("2026-07-06"), run("2026-07-07")],
                }
            ],
            "coach_advice": "Recover well",
        }
    )


def execute(*outcomes):
    repository = Repository()
    transactions = Transactions(repository)
    provider = Provider(outcomes, transactions)
    result = generate_validated_training_block(
        UserContext("verified-owner"),
        transactions,
        provider,
        current_instant=lambda: datetime(2026, 7, 1, 10, tzinfo=UTC),
    )
    return result, provider, repository, transactions


def violations_for(result, context):
    expected_count = len(context.provider_context.weeks)
    projected = context.full_projection[:expected_count]
    trajectory = SessionTrajectory(
        context.full_session_trajectory.weeks[:expected_count]
    )
    policy = GeneratedBlockPolicyContext(
        weeks=tuple(
            GeneratedBlockPolicyWeekContext(
                week.week_number,
                week.phase,
                context.readiness_calendar.weeks[index].role,
            )
            for index, week in enumerate(projected)
        ),
        readiness_status=context.readiness_capacity.status,
        safety_restriction_codes=context.provider_context.safety.restriction_codes,
    )
    return validate_generated_training_block(
        result,
        context.authorized_approach,
        context.generation_window_start,
        context.goal_date,
        projected,
        context.weekly_availability,
        trajectory,
        policy,
    )


def test_valid_first_candidate_returns_after_one_provider_call():
    result, provider, repository, transactions = execute(candidate())

    assert result is not None
    assert len(provider.contexts) == 1
    assert repository.reads == 1
    assert transactions.entries == 1
    assert violations_for(result, generate_context(provider.contexts[0])) == ()


def generate_context(provider_context):
    """Reassemble trusted context represented by the call for assertions."""
    repository = Repository()
    transactions = Transactions(repository)
    context = assemble_training_generation_context(
        UserContext("verified-owner"),
        transactions,
        current_instant=lambda: datetime(2026, 7, 1, 10, tzinfo=UTC),
    )
    assert context.provider_context == provider_context
    return context


def test_semantically_invalid_then_valid_retries_once_with_identical_context():
    result, provider, _, _ = execute(candidate(approach="mode_z"), candidate())

    assert len(provider.contexts) == 2
    assert provider.contexts[0] is provider.contexts[1]
    assert violations_for(result, generate_context(provider.contexts[0])) == ()


def test_second_semantically_invalid_candidate_fails_safely_after_two_calls():
    repository = Repository()
    transactions = Transactions(repository)
    provider = Provider(
        [candidate(approach="mode_z"), candidate(approach="mode_z")], transactions
    )

    with pytest.raises(GeneratedTrainingBlockRejected) as caught:
        generate_validated_training_block(
            UserContext("verified-owner"),
            transactions,
            provider,
            current_instant=lambda: datetime(2026, 7, 1, 10, tzinfo=UTC),
        )

    assert str(caught.value) == "generation_validation_failed"
    assert caught.value.__cause__ is None
    assert len(provider.contexts) == 2


@pytest.mark.parametrize(
    "failure",
    [
        TrainingGenerationTimeout(),
        TrainingGenerationRefused(),
        TrainingGenerationInvalidResponse(),
        TrainingGenerationUnavailable(),
    ],
)
def test_normalized_provider_failures_are_terminal_without_retry(failure):
    repository = Repository()
    transactions = Transactions(repository)
    provider = Provider([failure, candidate()], transactions)

    with pytest.raises(type(failure), match=f"^{failure}$") as caught:
        generate_validated_training_block(
            UserContext("verified-owner"),
            transactions,
            provider,
            current_instant=lambda: datetime(2026, 7, 1, 10, tzinfo=UTC),
        )

    assert caught.value.__cause__ is None
    assert len(provider.contexts) == 1
    assert repository.reads == 1
    assert transactions.entries == 1


@pytest.mark.parametrize(
    ("outcome", "failure_type", "message"),
    [
        (
            RuntimeError("raw transport details"),
            TrainingGenerationUnavailable,
            "generation_provider_unavailable",
        ),
        (None, TrainingGenerationInvalidResponse, "generation_invalid_response"),
    ],
)
def test_raw_transport_and_structurally_invalid_results_fail_safely_without_retry(
    outcome, failure_type, message
):
    repository = Repository()
    transactions = Transactions(repository)
    provider = Provider([outcome, candidate()], transactions)

    with pytest.raises(failure_type) as caught:
        generate_validated_training_block(
            UserContext("verified-owner"),
            transactions,
            provider,
            current_instant=lambda: datetime(2026, 7, 1, 10, tzinfo=UTC),
        )

    assert str(caught.value) == message
    assert caught.value.__cause__ is None
    assert "raw transport details" not in str(caught.value)
    assert len(provider.contexts) == 1
