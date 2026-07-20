"""Strict provider-neutral contract for the next generated training block.

This boundary contains only AI-generated block content. Full-horizon projections,
eligibility decisions, and other backend-computed insights remain outside it.
"""

from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StringConstraints,
    WithJsonSchema,
    field_serializer,
    field_validator,
    model_validator,
)

from app.modules.planning.domain import Approach

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
PositiveInteger = Annotated[int, Field(strict=True, gt=0)]
NonNegativeInteger = Annotated[int, Field(strict=True, ge=0)]
TargetRpe = Annotated[int, Field(strict=True, ge=1, le=10)]
SessionCategory = Literal["run", "strength", "recovery", "cross_training"]
IntensityBand = Literal["low", "threshold", "high"]
NonNegativeKilometers = Annotated[
    Decimal,
    Field(ge=Decimal("0"), allow_inf_nan=False),
    WithJsonSchema(
        {
            "type": "string",
            "description": (
                "Non-negative kilometers encoded as a base-10 decimal string; "
                "floats and booleans are forbidden."
            ),
        },
        mode="validation",
    ),
]


class _GeneratedContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GeneratedIntensitySegment(_GeneratedContractModel):
    """One explicitly timed running intensity segment."""

    duration_minutes: Annotated[
        int, Field(strict=True, gt=0, description="Exact minutes in this segment.")
    ]
    intensity_band: Annotated[
        IntensityBand,
        Field(description="Structured intensity used by whole-block sports policy."),
    ]


class GeneratedTrainingSession(_GeneratedContractModel):
    """One generated session.

    target_rpe_min <= target_rpe_max. Run sessions require at least one intensity
    segment whose minutes are exactly equal planned_duration_minutes. Non-run
    sessions require intensity_segments to be empty.
    """

    scheduled_date: Annotated[
        date,
        Field(description="Date inside the corresponding provider week window."),
    ]
    session_type: NonEmptyText
    session_category: SessionCategory
    planned_duration_minutes: Annotated[
        int,
        Field(
            strict=True,
            gt=0,
            description="Positive duration within the date's availability budget.",
        ),
    ]
    planned_distance_kilometers: NonNegativeKilometers
    planned_elevation_meters: NonNegativeInteger
    intensity_description: NonEmptyText
    intensity_segments: Annotated[
        list[GeneratedIntensitySegment],
        Field(
            description=(
                "Required and non-empty for runs, with total minutes equal to the "
                "planned duration; empty for every non-run session."
            )
        ),
    ]
    target_rpe_min: Annotated[
        int, Field(strict=True, ge=1, le=10, description="Lower inclusive RPE bound.")
    ]
    target_rpe_max: Annotated[
        int,
        Field(
            strict=True,
            ge=1,
            le=10,
            description="Upper inclusive RPE bound, never below target_rpe_min.",
        ),
    ]
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

    @model_validator(mode="after")
    def validate_structured_intensity(self) -> Self:
        if self.target_rpe_min > self.target_rpe_max:
            raise ValueError("target_rpe_min_must_not_exceed_target_rpe_max")

        if self.session_category == "run":
            if not self.intensity_segments:
                raise ValueError("run_sessions_require_intensity_segments")
            segment_minutes = sum(
                segment.duration_minutes for segment in self.intensity_segments
            )
            if segment_minutes != self.planned_duration_minutes:
                raise ValueError("run_intensity_segments_must_match_planned_duration")
        elif self.intensity_segments:
            raise ValueError("non_run_sessions_must_not_have_intensity_segments")

        return self


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
