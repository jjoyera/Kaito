"""Owner-bound assembly of minimal provider-safe training generation context."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Annotated, Any, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.modules.auth.context import UserContext
from app.modules.planning.domain import (
    Approach,
    ApproachAssessment,
    ApproachEligibilityPolicy,
    ProjectedWeek,
    WeeklyDistanceProjector,
)
from app.modules.planning.generated_block_policy import GENERATED_BLOCK_SPORTS_POLICY
from app.modules.planning.goal_demand import GoalDemand, calculate_goal_demand
from app.modules.planning.readiness_calendar import (
    ReadinessCalendar,
    ReadinessWeekRole,
    create_readiness_calendar,
)
from app.modules.planning.readiness_capacity import (
    ReadinessCapacityAssessment,
    assess_readiness_capacity,
)
from app.modules.planning.session_trajectory import (
    SessionTrajectory,
    SessionTrajectoryPolicy,
)
from app.modules.planning.use_cases import (
    BlockedTrainingApproach,
    IncompleteOnboarding,
    TrainingPlanPersistenceUnavailable,
)
from app.modules.runner_profile.domain import (
    OnboardingSnapshot,
    OnboardingState,
    WeeklyAvailability,
)
from app.modules.runner_profile.use_cases import CorruptOnboardingData
from app.modules.runner_profile.validation import parse_and_normalize
from app.modules.shared.domain.value_objects import UserId

if TYPE_CHECKING:
    from app.modules.planning.use_cases import TrainingPlanTransactionFactory

_MADRID = ZoneInfo("Europe/Madrid")
_LOAD_INCREASE_BLOCKING_CODES = frozenset(
    {"no_load_increase", "no_weekly_load_increase"}
)
_WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


class GenerationContextSourceNotFound(Exception):
    def __init__(self) -> None:
        super().__init__("generation_context_source_not_found")


class GenerationWindowUnavailable(Exception):
    pass


class _ProviderModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ProviderGoalContext(_ProviderModel):
    modality: Literal["trail", "ultra_trail"]
    target_distance_kilometers: Decimal
    positive_elevation_meters: Decimal
    km_effort: Decimal

    @field_serializer(
        "target_distance_kilometers", "positive_elevation_meters", "km_effort"
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return format(value, "f")


class ProviderReadinessContext(_ProviderModel):
    status: Literal["on_track", "constrained", "not_feasible"]
    minimum_peak_weekly_minutes: Annotated[int, Field(strict=True, gt=0)]
    required_peak_loading_weeks: Annotated[int, Field(strict=True, gt=0)]
    reason_codes: tuple[str, ...]


class ProviderSafetyContext(_ProviderModel):
    restriction_codes: tuple[str, ...]
    load_increase_blocked_for_horizon: bool


class ProviderAvailabilityDay(_ProviderModel):
    weekday: Literal[
        "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ]
    minutes: Annotated[int, Field(strict=True, ge=15, le=300)]


class ProviderSportsPolicyRules(_ProviderModel):
    """Static numeric and structured sports constraints enforced after generation."""

    minimum_low_percent: Annotated[int, Field(strict=True, ge=0, le=100)]
    maximum_high_percent: Annotated[int, Field(strict=True, ge=0, le=100)]
    maximum_threshold_and_high_percent: Annotated[
        int, Field(strict=True, ge=0, le=100)
    ]
    intensity_percentages_apply_across_entire_block: bool
    minimum_strength_minutes: Annotated[int, Field(strict=True, gt=0)]
    minimum_strength_duration_applies_to_every_strength_session: bool
    minimum_strength_sessions_when_required: Annotated[
        int, Field(strict=True, ge=0)
    ]
    maximum_strength_sessions_per_week: Annotated[int, Field(strict=True, ge=0)]
    strength_minimum_removing_restriction_codes: tuple[str, ...]
    high_intensity_segment_is_demanding: bool
    key_threshold_segment_is_demanding: bool
    demanding_target_rpe_max_at_least: Annotated[int, Field(strict=True, ge=1, le=10)]
    key_session_demanding_target_rpe_max_at_least: Annotated[
        int, Field(strict=True, ge=1, le=10)
    ]
    not_feasible_forbids_demanding_sessions: bool
    recovery_weeks_forbid_demanding_sessions: bool
    no_demanding_sessions_restriction_code: str
    reduced_demanding_restriction_code: str
    reduced_limit_forbids_high_intensity: bool
    reduced_limit_forbids_key_sessions: bool
    reduced_limit_target_rpe_max_at_least: Annotated[
        int, Field(strict=True, ge=1, le=10)
    ]
    maximum_demanding_sessions_across_taper_weeks: Annotated[
        int, Field(strict=True, ge=0)
    ]


class ProviderGenerationRules(_ProviderModel):
    """Deterministic rules the generated block must satisfy exactly."""

    exact_generated_week_count: Annotated[int, Field(strict=True, ge=1, le=4)]
    required_week_numbers: tuple[int, ...]
    applied_approach_must_equal_authorized: bool
    session_dates_must_be_within_week_window: bool
    session_dates_must_not_exceed_goal_date: bool
    sessions_must_use_available_weekdays: bool
    daily_session_minutes_are_aggregated: bool
    daily_session_minutes_must_not_exceed_available_minutes: bool
    weekly_running_distance_must_equal_target: bool
    run_sessions_must_respect_longest_outing_limits: bool
    load_increase_blocked_means_do_not_exceed_provided_targets: bool
    target_rpe_min_must_not_exceed_max: bool
    run_intensity_segments_required: bool
    run_intensity_segment_minutes_must_equal_duration: bool
    non_run_intensity_segments_must_be_empty: bool
    kilometer_representation: Literal["base_10_decimal_string"]
    kilometer_floats_and_booleans_forbidden: bool
    sports_policy: ProviderSportsPolicyRules


class ProviderWeekConstraint(_ProviderModel):
    week_number: Annotated[int, Field(strict=True, gt=0)]
    window_start: date
    window_end: date
    phase: Literal["loading", "recovery", "taper"]
    readiness_role: ReadinessWeekRole
    target_running_kilometers: Decimal
    maximum_longest_outing_kilometers: Decimal
    maximum_longest_outing_duration_minutes: Annotated[int, Field(strict=True, ge=0)]
    load_increase_blocked: bool
    strength_session_required: bool | None = None
    demanding_sessions_forbidden: bool | None = None
    reduced_demanding_limit_active: bool | None = None
    taper_demanding_session_limit_applies: bool | None = None

    @field_serializer(
        "target_running_kilometers", "maximum_longest_outing_kilometers"
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return format(value, "f")


class ProviderGenerationContext(_ProviderModel):
    """Strict minimal data that a future provider may receive."""

    authorized_approach: Approach
    generation_window_start: date
    goal_date: date
    goal: ProviderGoalContext
    readiness: ProviderReadinessContext
    safety: ProviderSafetyContext
    availability: tuple[ProviderAvailabilityDay, ...]
    rules: ProviderGenerationRules | None = None
    weeks: Annotated[
        tuple[ProviderWeekConstraint, ...], Field(min_length=1, max_length=4)
    ]

    @model_validator(mode="after")
    def derive_mandatory_rules(self) -> "ProviderGenerationContext":
        restrictions = frozenset(self.safety.restriction_codes)
        weeks = tuple(
            week.model_copy(
                update=_provider_week_rule_values(
                    week.phase,
                    week.readiness_role,
                    self.readiness.status,
                    restrictions,
                )
            )
            for week in self.weeks
        )
        object.__setattr__(self, "weeks", weeks)
        object.__setattr__(self, "rules", _provider_generation_rules(weeks))
        return self


def _provider_week_rule_values(
    phase: Literal["loading", "recovery", "taper"],
    readiness_role: ReadinessWeekRole,
    readiness_status: Literal["on_track", "constrained", "not_feasible"],
    restrictions: frozenset[str],
) -> dict[str, bool]:
    policy = GENERATED_BLOCK_SPORTS_POLICY
    strength_minimum_removed = bool(
        restrictions.intersection(policy.strength_minimum_removing_restrictions)
    )
    return {
        "strength_session_required": (
            (
                phase in policy.strength_required_projection_phases
                or readiness_role in policy.strength_required_readiness_roles
            )
            and not strength_minimum_removed
        ),
        "demanding_sessions_forbidden": (
            phase == "recovery"
            or readiness_role == "recovery"
            or readiness_status == "not_feasible"
            or policy.no_demanding_sessions_restriction in restrictions
        ),
        "reduced_demanding_limit_active": (
            policy.reduced_demanding_restriction in restrictions
        ),
        "taper_demanding_session_limit_applies": (
            phase == "taper" or readiness_role == "taper"
        ),
    }


def _provider_generation_rules(
    weeks: tuple[ProviderWeekConstraint, ...],
) -> ProviderGenerationRules:
    policy = GENERATED_BLOCK_SPORTS_POLICY
    return ProviderGenerationRules(
        exact_generated_week_count=len(weeks),
        required_week_numbers=tuple(week.week_number for week in weeks),
        applied_approach_must_equal_authorized=True,
        session_dates_must_be_within_week_window=True,
        session_dates_must_not_exceed_goal_date=True,
        sessions_must_use_available_weekdays=True,
        daily_session_minutes_are_aggregated=True,
        daily_session_minutes_must_not_exceed_available_minutes=True,
        weekly_running_distance_must_equal_target=True,
        run_sessions_must_respect_longest_outing_limits=True,
        load_increase_blocked_means_do_not_exceed_provided_targets=True,
        target_rpe_min_must_not_exceed_max=True,
        run_intensity_segments_required=True,
        run_intensity_segment_minutes_must_equal_duration=True,
        non_run_intensity_segments_must_be_empty=True,
        kilometer_representation="base_10_decimal_string",
        kilometer_floats_and_booleans_forbidden=True,
        sports_policy=ProviderSportsPolicyRules(
            minimum_low_percent=policy.minimum_low_percent,
            maximum_high_percent=policy.maximum_high_percent,
            maximum_threshold_and_high_percent=(
                policy.maximum_threshold_and_high_percent
            ),
            intensity_percentages_apply_across_entire_block=True,
            minimum_strength_minutes=policy.minimum_strength_minutes,
            minimum_strength_duration_applies_to_every_strength_session=True,
            minimum_strength_sessions_when_required=(
                policy.minimum_strength_sessions_when_required
            ),
            maximum_strength_sessions_per_week=(
                policy.maximum_strength_sessions_per_week
            ),
            strength_minimum_removing_restriction_codes=tuple(
                sorted(policy.strength_minimum_removing_restrictions)
            ),
            high_intensity_segment_is_demanding=True,
            key_threshold_segment_is_demanding=True,
            demanding_target_rpe_max_at_least=(
                policy.demanding_target_rpe_max_at_least
            ),
            key_session_demanding_target_rpe_max_at_least=(
                policy.key_session_demanding_target_rpe_max_at_least
            ),
            not_feasible_forbids_demanding_sessions=True,
            recovery_weeks_forbid_demanding_sessions=True,
            no_demanding_sessions_restriction_code=(
                policy.no_demanding_sessions_restriction
            ),
            reduced_demanding_restriction_code=policy.reduced_demanding_restriction,
            reduced_limit_forbids_high_intensity=True,
            reduced_limit_forbids_key_sessions=True,
            reduced_limit_target_rpe_max_at_least=(
                policy.demanding_target_rpe_max_at_least
            ),
            maximum_demanding_sessions_across_taper_weeks=(
                policy.maximum_demanding_sessions_across_taper_weeks
            ),
        ),
    )


@dataclass(frozen=True, slots=True)
class TrainingGenerationContext:
    """Immutable backend context retaining full-horizon deterministic calculations."""

    authorized_approach: Approach
    generation_window_start: date
    goal_date: date
    full_horizon_week_count: int
    full_projection: tuple[ProjectedWeek, ...]
    goal_demand: GoalDemand
    readiness_calendar: ReadinessCalendar
    readiness_capacity: ReadinessCapacityAssessment
    full_session_trajectory: SessionTrajectory
    weekly_availability: WeeklyAvailability
    provider_context: ProviderGenerationContext


def assemble_training_generation_context(
    user: UserContext,
    transactions: "TrainingPlanTransactionFactory",
    *,
    current_instant: Callable[[], datetime],
    eligibility_policy: ApproachEligibilityPolicy | None = None,
    distance_projector: WeeklyDistanceProjector | None = None,
    trajectory_policy: SessionTrajectoryPolicy | None = None,
) -> TrainingGenerationContext:
    """Read one owner's draft and onboarding, then assemble deterministic context."""

    stored = _read_owner_source(user, transactions)
    local_today = _local_assessment_date(current_instant)
    policy = eligibility_policy or ApproachEligibilityPolicy()
    snapshot, approach, approach_assessment = _validated_source(
        stored, local_today, policy
    )
    generation_start = _strictly_next_monday(local_today)
    goal_date = date.fromisoformat(snapshot.goal["target_date"])
    if goal_date < generation_start:
        raise GenerationWindowUnavailable("goal_before_generation_window")

    horizon_weeks = (goal_date - generation_start).days // 7 + 1
    profile, goal = snapshot.profile, snapshot.goal
    baseline = profile["baseline_4_weeks"]
    availability = WeeklyAvailability(profile["availability"]["minutes_by_day"])
    baseline_weekly_distance = _decimal(baseline["distance_km"]) / Decimal(4)

    projection = (distance_projector or WeeklyDistanceProjector()).project(
        baseline_weekly_distance, horizon_weeks, approach
    )
    demand = calculate_goal_demand(
        _decimal(goal["target_distance_km"]),
        _decimal(goal["positive_elevation_m"]),
    )
    calendar = create_readiness_calendar(
        horizon_weeks, demand.required_peak_loading_weeks
    )
    load_blocked = bool(
        _LOAD_INCREASE_BLOCKING_CODES.intersection(
            approach_assessment.safety_restriction_codes
        )
    )
    capacity = assess_readiness_capacity(
        demand,
        calendar,
        baseline["total_running_minutes"],
        availability.total_minutes,
        baseline["recent_consistency"],
        approach_assessment.safety_restriction_codes,
        load_blocked,
    )
    trajectory = (trajectory_policy or SessionTrajectoryPolicy()).calculate(
        _decimal(baseline["longest_outing_km"]),
        baseline["longest_outing_duration_minutes"],
        approach,
        projection.weeks,
    )
    provider_context = _provider_context(
        approach=approach,
        generation_start=generation_start,
        goal_date=goal_date,
        snapshot=snapshot,
        demand=demand,
        calendar=calendar,
        capacity=capacity,
        restrictions=approach_assessment.safety_restriction_codes,
        load_blocked=load_blocked,
        availability=availability,
        projected_weeks=projection.weeks,
        trajectory=trajectory,
    )
    return TrainingGenerationContext(
        authorized_approach=approach,
        generation_window_start=generation_start,
        goal_date=goal_date,
        full_horizon_week_count=horizon_weeks,
        full_projection=projection.weeks,
        goal_demand=demand,
        readiness_calendar=calendar,
        readiness_capacity=capacity,
        full_session_trajectory=trajectory,
        weekly_availability=availability,
        provider_context=provider_context,
    )


def _read_owner_source(
    user: UserContext, transactions: "TrainingPlanTransactionFactory"
) -> Mapping[str, Any]:
    try:
        with transactions(user) as repository:
            stored = repository.read_generation_source(UserId(user.user_id))
    except Exception as error:
        raise TrainingPlanPersistenceUnavailable() from error
    if not stored:
        raise GenerationContextSourceNotFound()
    return stored


def _local_assessment_date(current_instant: Callable[[], datetime]) -> date:
    instant = current_instant()
    if (
        not isinstance(instant, datetime)
        or instant.tzinfo is None
        or instant.utcoffset() is None
    ):
        raise GenerationWindowUnavailable("current_instant_must_be_aware")
    return instant.astimezone(_MADRID).date()


def _strictly_next_monday(today: date) -> date:
    days = (7 - today.weekday()) % 7
    return today + timedelta(days=7 if days == 0 else days)


def _validated_source(
    stored: Mapping[str, Any],
    assessment_date: date,
    policy: ApproachEligibilityPolicy,
) -> tuple[OnboardingSnapshot, Approach, ApproachAssessment]:
    if "snapshot" not in stored or "plan_approach" not in stored:
        raise GenerationContextSourceNotFound()
    try:
        snapshot, _ = parse_and_normalize(stored["snapshot"], assessment_date)
    except (KeyError, TypeError, ValueError) as error:
        raise CorruptOnboardingData("stored_onboarding_snapshot_is_invalid") from error
    if snapshot.state is not OnboardingState.COMPLETED:
        raise IncompleteOnboarding()
    try:
        approach = stored["plan_approach"]
        assessment = policy.assess(
            {"profile": snapshot.profile, "goal": snapshot.goal}, assessment_date
        )
        selected = next(
            item for item in assessment.approaches if item.approach == approach
        )
    except (KeyError, StopIteration, TypeError, ValueError) as error:
        raise CorruptOnboardingData("stored_onboarding_snapshot_is_invalid") from error
    if not selected.available:
        raise BlockedTrainingApproach()
    return snapshot, approach, assessment


def _provider_context(
    *,
    approach: Approach,
    generation_start: date,
    goal_date: date,
    snapshot: OnboardingSnapshot,
    demand: GoalDemand,
    calendar: ReadinessCalendar,
    capacity: ReadinessCapacityAssessment,
    restrictions: tuple[str, ...],
    load_blocked: bool,
    availability: WeeklyAvailability,
    projected_weeks: tuple[ProjectedWeek, ...],
    trajectory: SessionTrajectory,
) -> ProviderGenerationContext:
    initial_count = min(4, len(projected_weeks))
    weeks = tuple(
        ProviderWeekConstraint(
            week_number=projected.week_number,
            window_start=generation_start + timedelta(days=index * 7),
            window_end=min(
                generation_start + timedelta(days=index * 7 + 6), goal_date
            ),
            phase=projected.phase,
            readiness_role=calendar.weeks[index].role,
            target_running_kilometers=projected.estimated_kilometers,
            maximum_longest_outing_kilometers=(
                trajectory.weeks[index].maximum_longest_outing_kilometers
            ),
            maximum_longest_outing_duration_minutes=(
                trajectory.weeks[index].maximum_longest_outing_duration_minutes
            ),
            load_increase_blocked=load_blocked,
        )
        for index, projected in enumerate(projected_weeks[:initial_count])
    )
    goal = snapshot.goal
    return ProviderGenerationContext(
        authorized_approach=approach,
        generation_window_start=generation_start,
        goal_date=goal_date,
        goal=ProviderGoalContext(
            modality=goal["modality"],
            target_distance_kilometers=_decimal(goal["target_distance_km"]),
            positive_elevation_meters=_decimal(goal["positive_elevation_m"]),
            km_effort=demand.km_effort,
        ),
        readiness=ProviderReadinessContext(
            status=capacity.status,
            minimum_peak_weekly_minutes=demand.minimum_peak_weekly_minutes,
            required_peak_loading_weeks=demand.required_peak_loading_weeks,
            reason_codes=capacity.reason_codes,
        ),
        safety=ProviderSafetyContext(
            restriction_codes=restrictions,
            load_increase_blocked_for_horizon=load_blocked,
        ),
        availability=tuple(
            ProviderAvailabilityDay(
                weekday=weekday, minutes=availability.minutes_by_day[weekday]
            )
            for weekday in _WEEKDAYS
            if weekday in availability.minutes_by_day
        ),
        weeks=weeks,
    )


def _decimal(value: object) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("invalid_decimal_source")
    return Decimal(str(value))
