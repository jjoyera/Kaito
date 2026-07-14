"""Protected onboarding HTTP routes.

Task 3.1 supplies only import-safe route declarations. Task 3.2 maps the
approved use-case outcomes into the public response contract.
"""

from collections.abc import Mapping
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.modules.auth.context import UserContext
from app.modules.auth.dependencies import get_current_user
from app.modules.runner_profile.schemas import SaveOnboardingRequest
from app.modules.runner_profile.use_cases import (
    CorruptOnboardingData,
    InvalidOnboardingInput,
    OnboardingNotFound,
    OnboardingPersistenceUnavailable,
    OnboardingResult,
    OwnerTransactionFactory,
    ReadOnboardingInput,
    SaveOnboardingInput,
    read_onboarding,
    save_onboarding,
)

router = APIRouter(prefix="/runner-profile", tags=["runner-profile"])


def get_owner_transactions(request: Request) -> OwnerTransactionFactory:
    """Return the production factory composed after guarded startup succeeds."""
    try:
        return request.app.state.onboarding_transactions
    except AttributeError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Service unavailable"
        ) from None


def _json_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_json_value(item) for item in value]
    return value


def _response(result: OnboardingResult) -> dict[str, Any]:
    snapshot = result.snapshot
    return {
        "snapshot": {
            "contract_version": snapshot.contract_version,
            "state": snapshot.state.value,
            "profile": _json_value(snapshot.profile),
            "goal": _json_value(snapshot.goal),
        },
        "diagnostics": [
            {
                "code": diagnostic.code,
                "field": diagnostic.field,
                "message_key": diagnostic.message_key,
                "severity": diagnostic.severity,
                "metadata": _json_value(diagnostic.metadata),
            }
            for diagnostic in result.diagnostics
        ],
    }


@router.put("/onboarding")
def save_onboarding_route(
    data: SaveOnboardingRequest,
    user: Annotated[UserContext, Depends(get_current_user)],
    transactions: Annotated[OwnerTransactionFactory, Depends(get_owner_transactions)],
) -> dict:
    """Save the verified caller's canonical onboarding snapshot."""
    try:
        result = save_onboarding(
            user,
            SaveOnboardingInput(
                snapshot=data.snapshot, validation_date=data.validation_date
            ),
            transactions,
        )
    except InvalidOnboardingInput:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid onboarding snapshot"
        ) from None
    except OnboardingPersistenceUnavailable:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Service unavailable"
        ) from None
    return _response(result)


@router.get("/onboarding")
def read_onboarding_route(
    validation_date: Annotated[date, Query()],
    user: Annotated[UserContext, Depends(get_current_user)],
    transactions: Annotated[OwnerTransactionFactory, Depends(get_owner_transactions)],
) -> dict:
    """Read and revalidate the verified caller's onboarding snapshot."""
    try:
        result = read_onboarding(
            user,
            ReadOnboardingInput(validation_date=validation_date),
            transactions,
        )
    except OnboardingNotFound:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Onboarding snapshot not found"
        ) from None
    except CorruptOnboardingData:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Stored onboarding snapshot is invalid",
        ) from None
    except OnboardingPersistenceUnavailable:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Service unavailable"
        ) from None
    return _response(result)
