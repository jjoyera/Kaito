from datetime import UTC, date, datetime
from typing import Annotated, Literal

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict

from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from app.modules.planning.domain import UnsupportedEligibilityModality
from app.modules.planning.use_cases import (
    AssessTrainingApproachesInput,
    BlockedTrainingApproach,
    DraftPlanConflict,
    IncompleteOnboarding,
    SaveTrainingPlanDraftInput,
    TrainingPlanPersistenceUnavailable,
    TrainingPlanTransactionFactory,
    assess_training_approaches,
    save_training_plan_draft,
)
from app.modules.runner_profile.use_cases import (
    CorruptOnboardingData,
    OnboardingNotFound,
    OnboardingPersistenceUnavailable,
    OwnerTransactionFactory,
)

router = APIRouter(prefix="/planning", tags=["planning"])
_SERVICE_UNAVAILABLE_DETAIL = "Service unavailable"


def get_owner_transactions(request: Request) -> OwnerTransactionFactory:
    try:
        return request.app.state.onboarding_transactions
    except AttributeError as error:
        sentry_sdk.capture_exception(error)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, _SERVICE_UNAVAILABLE_DETAIL
        ) from None


def get_training_plan_transactions(request: Request) -> TrainingPlanTransactionFactory:
    try:
        return request.app.state.training_plan_transactions
    except AttributeError as error:
        sentry_sdk.capture_exception(error)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, _SERVICE_UNAVAILABLE_DETAIL
        ) from None


def get_trusted_utc_date() -> date:
    return datetime.now(UTC).date()


class SaveTrainingPlanDraftBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_approach: Literal["kaio_path", "mode_z", "kaioken"]


@router.get("/training-approach-eligibility")
def training_approach_eligibility_route(
    assessment_date: Annotated[date, Query()],
    user: Annotated[UserContext, Depends(get_current_user)],
    transactions: Annotated[OwnerTransactionFactory, Depends(get_owner_transactions)],
    trusted_utc_date: Annotated[date, Depends(get_trusted_utc_date)],
) -> dict:
    """Assess the verified caller's completed onboarding at a fresh local date."""
    if assessment_date != trusted_utc_date:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "assessment_date_out_of_range"
        )
    try:
        result = assess_training_approaches(
            user,
            AssessTrainingApproachesInput(trusted_utc_date),
            transactions,
        )
    except OnboardingNotFound:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Onboarding snapshot not found"
        ) from None
    except IncompleteOnboarding:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Onboarding is incomplete"
        ) from None
    except UnsupportedEligibilityModality:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "unsupported_modality",
        ) from None
    except CorruptOnboardingData as error:
        sentry_sdk.capture_exception(error.__cause__ or error)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Stored onboarding snapshot is invalid",
        ) from None
    except OnboardingPersistenceUnavailable as error:
        sentry_sdk.capture_exception(error.__cause__ or error)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, _SERVICE_UNAVAILABLE_DETAIL
        ) from None
    return {
        "recommended_approach": result.recommended_approach,
        "approaches": [
            {
                "approach": item.approach,
                "available": item.available,
                "blocking_reason_codes": list(item.blocking_reason_codes),
            }
            for item in result.approaches
        ],
        "safety_restriction_codes": list(result.safety_restriction_codes),
    }


@router.put("/training-plan-draft")
def training_plan_draft_route(
    body: SaveTrainingPlanDraftBody,
    user: Annotated[UserContext, Depends(get_current_user)],
    transactions: Annotated[
        TrainingPlanTransactionFactory, Depends(get_training_plan_transactions)
    ],
    trusted_utc_date: Annotated[date, Depends(get_trusted_utc_date)],
) -> dict[str, str]:
    try:
        result = save_training_plan_draft(
            user,
            SaveTrainingPlanDraftInput(body.plan_approach),
            transactions,
            trusted_utc_date,
        )
    except OnboardingNotFound:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Onboarding snapshot not found"
        ) from None
    except IncompleteOnboarding:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Onboarding is incomplete"
        ) from None
    except UnsupportedEligibilityModality:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "unsupported_modality"
        ) from None
    except BlockedTrainingApproach:
        raise HTTPException(status.HTTP_409_CONFLICT, "blocked_approach") from None
    except DraftPlanConflict:
        raise HTTPException(status.HTTP_409_CONFLICT, "draft_plan_conflict") from None
    except CorruptOnboardingData as error:
        sentry_sdk.capture_exception(error.__cause__ or error)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Stored onboarding snapshot is invalid",
        ) from None
    except TrainingPlanPersistenceUnavailable as error:
        sentry_sdk.capture_exception(error.__cause__ or error)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, _SERVICE_UNAVAILABLE_DETAIL
        ) from None
    return {
        "plan_id": result.plan_id,
        "status": result.status,
        "plan_approach": result.plan_approach,
    }
