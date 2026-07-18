from collections.abc import Mapping
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol

from app.modules.auth.context import UserContext
from app.modules.planning.domain import (
    Approach,
    ApproachAssessment,
    ApproachEligibilityPolicy,
    TrainingPlanDraft,
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


class BlockedTrainingApproach(Exception):
    def __init__(self) -> None:
        super().__init__("blocked_approach")


class DraftPlanConflict(Exception):
    def __init__(self) -> None:
        super().__init__("draft_plan_conflict")


class TrainingPlanPersistenceUnavailable(Exception):
    def __init__(self) -> None:
        super().__init__("service_unavailable")


@dataclass(frozen=True, slots=True)
class SaveTrainingPlanDraftInput:
    plan_approach: Approach


class TrainingPlanRepository(Protocol):
    def read_onboarding(self, owner_id: UserId) -> Mapping[str, Any] | None: ...

    def save_draft(
        self, owner_id: UserId, approach: Approach
    ) -> Mapping[str, Any]: ...


class TrainingPlanTransactionFactory(Protocol):
    def __call__(
        self, user: UserContext
    ) -> AbstractContextManager[TrainingPlanRepository]: ...


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


def save_training_plan_draft(
    user: UserContext,
    data: SaveTrainingPlanDraftInput,
    transactions: TrainingPlanTransactionFactory,
    trusted_utc_date: date,
    policy: ApproachEligibilityPolicy | None = None,
) -> TrainingPlanDraft:
    owner_id = UserId(user.user_id)
    expected_error: Exception | None = None
    saved: Mapping[str, Any] | None = None
    try:
        with transactions(user) as repository:
            stored = repository.read_onboarding(owner_id)
            if stored is None:
                expected_error = OnboardingNotFound("onboarding_snapshot_not_found")
            elif (
                stored.get("state") == "completed"
                and isinstance(stored.get("goal"), Mapping)
                and stored["goal"].get("modality") in {"ocr", "backyard"}
            ):
                expected_error = UnsupportedEligibilityModality()
            else:
                try:
                    snapshot, _ = parse_and_normalize(stored, trusted_utc_date)
                    if snapshot.state is not OnboardingState.COMPLETED:
                        expected_error = IncompleteOnboarding()
                    else:
                        assessment = (policy or ApproachEligibilityPolicy()).assess(
                            {"profile": snapshot.profile, "goal": snapshot.goal},
                            trusted_utc_date,
                        )
                        selected = next(
                            item
                            for item in assessment.approaches
                            if item.approach == data.plan_approach
                        )
                        if not selected.available:
                            expected_error = BlockedTrainingApproach()
                except UnsupportedEligibilityModality as error:
                    expected_error = error
                except ValueError as error:
                    expected_error = CorruptOnboardingData(
                        "stored_onboarding_snapshot_is_invalid"
                    )
                    expected_error.__cause__ = error
            if expected_error is None:
                try:
                    saved = repository.save_draft(owner_id, data.plan_approach)
                except DraftPlanConflict as error:
                    expected_error = error
    except Exception as error:
        raise TrainingPlanPersistenceUnavailable() from error
    if expected_error is not None:
        raise expected_error
    if saved is None:
        raise TrainingPlanPersistenceUnavailable()
    return TrainingPlanDraft(
        plan_id=str(saved["plan_id"]),
        status="draft",
        plan_approach=saved["plan_approach"],
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
