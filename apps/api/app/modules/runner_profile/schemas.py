"""HTTP request contracts for the runner-profile onboarding routes."""

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict


class SaveOnboardingRequest(BaseModel):
    """Strict public payload for saving one onboarding snapshot."""

    model_config = ConfigDict(extra="forbid")

    snapshot: dict[str, Any]
    validation_date: date
