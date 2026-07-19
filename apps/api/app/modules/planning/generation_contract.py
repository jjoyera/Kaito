"""Strict provider-neutral contract for the next generated training block.

This boundary contains only AI-generated block content. Full-horizon projections,
eligibility decisions, and other backend-computed insights remain outside it.
"""

from datetime import date
from decimal import Decimal
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StringConstraints,
    field_serializer,
    field_validator,
)

from app.modules.planning.domain import Approach

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
PositiveInteger = Annotated[int, Field(strict=True, gt=0)]
NonNegativeInteger = Annotated[int, Field(strict=True, ge=0)]
NonNegativeKilometers = Annotated[
    Decimal, Field(ge=Decimal("0"), allow_inf_nan=False)
]


class _GeneratedContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GeneratedTrainingSession(_GeneratedContractModel):
    """One AI-generated session in the bounded training block."""

    scheduled_date: date
    session_type: NonEmptyText
    planned_duration_minutes: PositiveInteger
    planned_distance_kilometers: NonNegativeKilometers
    planned_elevation_meters: NonNegativeInteger
    intensity_description: NonEmptyText
    is_key_session: StrictBool
    purpose: NonEmptyText
    instructions: NonEmptyText

    @field_validator("planned_distance_kilometers", mode="before")
    @classmethod
    def reject_ambiguous_kilometer_types(cls, value: Any) -> Any:
        if isinstance(value, bool | float):
            raise ValueError("kilometers_must_use_a_decimal_string_or_integer")
        return value

    @field_serializer("planned_distance_kilometers")
    def serialize_kilometers(self, value: Decimal) -> str:
        """Serialize kilometers as a base-10 string without float conversion."""
        return format(value, "f")


class GeneratedTrainingWeek(_GeneratedContractModel):
    """One generated week; sequencing is validated by a later policy."""

    week_number: PositiveInteger
    week_goal: NonEmptyText
    sessions: list[GeneratedTrainingSession]


class GeneratedTrainingBlock(_GeneratedContractModel):
    """AI-generated content for the next one-to-four-week training block.

    ``applied_approach`` repeats a backend-authorized approach; this model does not
    determine eligibility or authorize an approach.
    """

    applied_approach: Approach
    block_focus: NonEmptyText
    weeks: Annotated[list[GeneratedTrainingWeek], Field(min_length=1, max_length=4)]
    coach_advice: NonEmptyText
