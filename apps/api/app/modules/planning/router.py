from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Literal

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict

from app.core.ai.openai_training_block import OpenAITrainingBlockProvider
from app.core.config import OpenAIConfigError
from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from app.modules.planning.domain import UnsupportedEligibilityModality
from app.modules.planning.generation_context import (
    GenerationContextSourceNotFound,
    GenerationWindowUnavailable,
)
from app.modules.planning.generation_provider import (
    TrainingGenerationInvalidResponse,
    TrainingGenerationRefused,
    TrainingGenerationTimeout,
    TrainingGenerationUnavailable,
)
from app.modules.planning.generation_use_case import (
    GeneratedTrainingBlockRejected,
    generate_and_activate_training_plan,
)
from app.modules.planning.use_cases import (
    ActiveTrainingPlan,
    AssessTrainingApproachesInput,
    BlockedTrainingApproach,
    DraftPlanConflict,
    IncompleteOnboarding,
    SaveTrainingPlanDraftInput,
    TrainingPlanPersistenceUnavailable,
    TrainingPlanTransactionFactory,
    assess_training_approaches,
    read_active_training_plan,
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


def get_current_instant() -> datetime:
    return datetime.now(UTC)


def get_training_block_provider():
    try:
        return OpenAITrainingBlockProvider.from_environment()
    except OpenAIConfigError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Generation provider unavailable"
        ) from None


class PublicTrainingSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheduled_date: date
    session_type: str
    planned_duration_minutes: int
    planned_distance_kilometers: Decimal
    planned_elevation_meters: int
    intensity_description: str
    target_rpe_min: int
    target_rpe_max: int
    instructions: str
    purpose: str


class PublicTrainingWeek(BaseModel):
    model_config = ConfigDict(extra="forbid")

    week_number: int
    sessions: tuple[PublicTrainingSession, ...]


class PublicTrainingPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan_approach: Literal["kaio_path", "mode_z", "kaioken"]
    start_date: date
    end_date: date
    block_focus: str
    weeks: tuple[PublicTrainingWeek, ...]


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


@router.post("/generate", response_model=PublicTrainingPlan)
def generate_training_plan_route(
    user: Annotated[UserContext, Depends(get_current_user)],
    transactions: Annotated[
        TrainingPlanTransactionFactory, Depends(get_training_plan_transactions)
    ],
    provider: Annotated[object, Depends(get_training_block_provider)],
    current_instant: Annotated[datetime, Depends(get_current_instant)],
) -> PublicTrainingPlan:
    try:
        generate_and_activate_training_plan(
            user,
            transactions,
            provider,
            current_instant=lambda: current_instant,
        )
        plan = read_active_training_plan(user, transactions)
    except GenerationContextSourceNotFound:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Planning source not found"
        ) from None
    except (IncompleteOnboarding, BlockedTrainingApproach, GenerationWindowUnavailable):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Training plan cannot be generated"
        ) from None
    except (CorruptOnboardingData, UnsupportedEligibilityModality):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Training plan input is invalid"
        ) from None
    except (GeneratedTrainingBlockRejected, TrainingGenerationInvalidResponse):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Generated training plan is invalid",
        ) from None
    except (
        TrainingGenerationTimeout,
        TrainingGenerationRefused,
        TrainingGenerationUnavailable,
    ):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Generation provider unavailable"
        ) from None
    except TrainingPlanPersistenceUnavailable:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, _SERVICE_UNAVAILABLE_DETAIL
        ) from None
    if plan is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, _SERVICE_UNAVAILABLE_DETAIL
        )
    return _public_training_plan(plan)


@router.get("/active", response_model=PublicTrainingPlan)
def active_training_plan_route(
    user: Annotated[UserContext, Depends(get_current_user)],
    transactions: Annotated[
        TrainingPlanTransactionFactory, Depends(get_training_plan_transactions)
    ],
) -> PublicTrainingPlan:
    try:
        plan = read_active_training_plan(user, transactions)
    except TrainingPlanPersistenceUnavailable:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, _SERVICE_UNAVAILABLE_DETAIL
        ) from None
    if plan is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Active training plan not found"
        )
    return _public_training_plan(plan)


def _public_training_plan(plan: ActiveTrainingPlan) -> PublicTrainingPlan:
    return PublicTrainingPlan(
        plan_approach=plan.plan_approach,
        start_date=plan.start_date,
        end_date=plan.end_date,
        block_focus=plan.block_focus,
        weeks=tuple(
            PublicTrainingWeek(
                week_number=week.week_number,
                sessions=tuple(
                    PublicTrainingSession(
                        scheduled_date=session.scheduled_date,
                        session_type=session.session_type,
                        planned_duration_minutes=session.planned_duration_minutes,
                        planned_distance_kilometers=(
                            session.planned_distance_kilometers
                        ),
                        planned_elevation_meters=session.planned_elevation_meters,
                        intensity_description=session.intensity_description,
                        target_rpe_min=session.target_rpe_min,
                        target_rpe_max=session.target_rpe_max,
                        instructions=session.instructions,
                        purpose=session.purpose,
                    )
                    for session in sorted(
                        week.sessions, key=lambda item: item.session_order
                    )
                ),
            )
            for week in sorted(plan.weeks, key=lambda item: item.week_number)
        ),
    )


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
