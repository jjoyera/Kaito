from dataclasses import dataclass
from datetime import date

from app.modules.auth.context import UserContext
from app.modules.planning.domain import (
    ApproachAssessment,
    ApproachEligibilityPolicy,
    UnsupportedEligibilityModality,
)
from app.modules.runner_profile.domain import OnboardingState
from app.modules.runner_profile.use_cases import (
    CorruptOnboardingData,
    OnboardingNotFound,
    OnboardingPersistenceUnavailable,
    OnboardingResult,
    OwnerTransactionFactory,
)
from app.modules.runner_profile.validation import parse_and_normalize
from app.modules.shared.domain.value_objects import UserId


@dataclass(frozen=True, slots=True)
class AssessTrainingApproachesInput:
    assessment_date: date


class IncompleteOnboarding(Exception):
    def __init__(self) -> None:
        super().__init__("onboarding_incomplete")


def assess_training_approaches(
    user: UserContext,
    data: AssessTrainingApproachesInput,
    transactions: OwnerTransactionFactory,
    policy: ApproachEligibilityPolicy | None = None,
) -> ApproachAssessment:
    onboarding = _read_onboarding_without_mutation(
        user, data.assessment_date, transactions
    )
    if onboarding.snapshot.state is not OnboardingState.COMPLETED:
        raise IncompleteOnboarding()
    snapshot = {
        "profile": onboarding.snapshot.profile,
        "goal": onboarding.snapshot.goal,
    }
    return (policy or ApproachEligibilityPolicy()).assess(
        snapshot, data.assessment_date
    )


def _read_onboarding_without_mutation(
    user: UserContext,
    validation_date: date,
    transactions: OwnerTransactionFactory,
) -> OnboardingResult:
    try:
        with transactions(user) as repository:
            stored = repository.read(UserId(user.user_id))
    except Exception as error:
        raise OnboardingPersistenceUnavailable() from error
    if stored is None:
        raise OnboardingNotFound("onboarding_snapshot_not_found")
    try:
        snapshot, diagnostics = parse_and_normalize(stored, validation_date)
    except ValueError as error:
        raise CorruptOnboardingData("stored_onboarding_snapshot_is_invalid") from error
    if (
        stored.get("state") == "completed"
        and snapshot.goal.get("modality") in {"ocr", "backyard"}
    ):
        raise UnsupportedEligibilityModality()
    return OnboardingResult(snapshot, diagnostics)
