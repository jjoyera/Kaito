import json
from datetime import date
from decimal import Decimal

import pytest

from app.modules.planning.generation_context import (
    ProviderAvailabilityDay,
    ProviderGenerationContext,
    ProviderGenerationRules,
    ProviderGoalContext,
    ProviderReadinessContext,
    ProviderSafetyContext,
    ProviderSportsPolicyRules,
    ProviderWeekConstraint,
)


def provider_context() -> ProviderGenerationContext:
    return ProviderGenerationContext(
        authorized_approach="mode_z",
        generation_window_start=date(2026, 7, 6),
        goal_date=date(2026, 8, 2),
        goal=ProviderGoalContext(
            modality="trail",
            target_distance_kilometers=Decimal("42.50"),
            positive_elevation_meters=Decimal("1500.00"),
            km_effort=Decimal("57.50"),
        ),
        readiness=ProviderReadinessContext(
            status="constrained",
            minimum_peak_weekly_minutes=240,
            required_peak_loading_weeks=3,
            reason_codes=("limited_time",),
        ),
        safety=ProviderSafetyContext(
            restriction_codes=("no_load_increase",),
            load_increase_blocked_for_horizon=True,
        ),
        availability=(
            ProviderAvailabilityDay(weekday="tuesday", minutes=60),
            ProviderAvailabilityDay(weekday="saturday", minutes=150),
        ),
        rules=ProviderGenerationRules(
            exact_generated_week_count=1,
            required_week_numbers=(1,),
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
                minimum_low_percent=75,
                maximum_high_percent=10,
                maximum_threshold_and_high_percent=25,
                intensity_percentages_apply_across_entire_block=True,
                minimum_strength_minutes=20,
                minimum_strength_duration_applies_to_every_strength_session=True,
                minimum_strength_sessions_when_required=1,
                maximum_strength_sessions_per_week=1,
                strength_minimum_removing_restriction_codes=(
                    "favor_recovery_rest_or_gentle_activity",
                    "no_demanding_sessions",
                ),
                high_intensity_segment_is_demanding=True,
                key_threshold_segment_is_demanding=True,
                demanding_target_rpe_max_at_least=8,
                key_session_demanding_target_rpe_max_at_least=7,
                not_feasible_forbids_demanding_sessions=True,
                recovery_weeks_forbid_demanding_sessions=True,
                no_demanding_sessions_restriction_code="no_demanding_sessions",
                reduced_demanding_restriction_code=(
                    "reduce_demanding_session_intensity_or_duration"
                ),
                reduced_limit_forbids_high_intensity=True,
                reduced_limit_forbids_key_sessions=True,
                reduced_limit_target_rpe_max_at_least=8,
                maximum_demanding_sessions_across_taper_weeks=1,
            ),
        ),
        weeks=(
            ProviderWeekConstraint(
                week_number=1,
                window_start=date(2026, 7, 6),
                window_end=date(2026, 7, 12),
                phase="loading",
                readiness_role="peak",
                target_running_kilometers=Decimal("30.00"),
                maximum_longest_outing_kilometers=Decimal("15.50"),
                maximum_longest_outing_duration_minutes=120,
                load_increase_blocked=True,
                strength_session_required=True,
                demanding_sessions_forbidden=False,
                reduced_demanding_limit_active=False,
                taper_demanding_session_limit_applies=False,
            ),
        ),
    )


def test_prompt_has_exact_versioned_instruction_structure() -> None:
    from app.core.ai.training_block_prompt_v1 import (
        PROMPT_INSTRUCTIONS,
        PROMPT_VERSION,
        render_training_block_prompt,
    )

    rendered = render_training_block_prompt(provider_context())

    assert PROMPT_VERSION == "training-block-v1"
    assert rendered == (
        "prompt_version: training-block-v1\n"
        f"instructions:\n{PROMPT_INSTRUCTIONS}\n"
        "provider_generation_context_json:\n"
        + json.dumps(
            provider_context().model_dump(mode="json"),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
        )
    )
    assert (
        "The backend-owned authorized approach is a constraint, not a choice."
        in rendered
    )
    assert (
        "Dates, weekly running distance, availability, session trajectory, "
        "readiness, and sports restrictions are constraints, not choices."
        in rendered
    )
    assert "Do not diagnose medical conditions." in rendered
    assert "Do not invent missing data." in rendered
    assert "Satisfy every machine-readable rule" in rendered
    assert "not_feasible forbids every demanding session" in rendered
    assert "Return only the structured GeneratedTrainingBlock schema." in rendered


def test_prompt_serializes_rules_without_duplicating_numeric_policy_prose() -> None:
    from app.core.ai.training_block_prompt_v1 import (
        PROMPT_INSTRUCTIONS,
        render_training_block_prompt,
    )

    rendered = render_training_block_prompt(provider_context())
    payload = json.loads(rendered.split("provider_generation_context_json:\n", 1)[1])

    assert payload["rules"]["exact_generated_week_count"] == 1
    assert payload["rules"]["required_week_numbers"] == [1]
    assert payload["rules"]["sports_policy"]["minimum_low_percent"] == 75
    assert payload["weeks"][0]["strength_session_required"] is True
    assert "75%" not in PROMPT_INSTRUCTIONS
    assert "20 minutes" not in PROMPT_INSTRUCTIONS


def test_context_json_is_deterministic_and_preserves_decimal_strings() -> None:
    from app.core.ai.training_block_prompt_v1 import render_training_block_prompt

    first = render_training_block_prompt(provider_context())
    second = render_training_block_prompt(provider_context())
    payload = json.loads(first.split("provider_generation_context_json:\n", 1)[1])

    assert first == second
    assert payload["goal"]["target_distance_kilometers"] == "42.50"
    assert payload["weeks"][0]["target_running_kilometers"] == "30.00"
    assert payload["weeks"][0]["maximum_longest_outing_kilometers"] == "15.50"


def test_serialized_context_recursively_excludes_private_and_provider_diagnostics(
) -> None:
    from app.core.ai.training_block_prompt_v1 import render_training_block_prompt

    payload = json.loads(
        render_training_block_prompt(provider_context()).split(
            "provider_generation_context_json:\n", 1
        )[1]
    )
    forbidden = {
        "user_id",
        "owner_id",
        "email",
        "token",
        "api_key",
        "openai_api_key",
        "provider_response",
        "provider_error",
        "diagnostics",
        "database_url",
        "snapshot",
    }

    def keys(value: object) -> set[str]:
        if isinstance(value, dict):
            return set(value).union(*(keys(item) for item in value.values()))
        if isinstance(value, list):
            return set().union(*(keys(item) for item in value))
        return set()

    assert keys(payload).isdisjoint(forbidden)
    rendered_lower = json.dumps(payload).lower()
    assert "api key" not in rendered_lower
    assert "provider diagnostics" not in rendered_lower


@pytest.mark.parametrize(
    "value", [{}, provider_context().model_dump(mode="json"), object()]
)
def test_renderer_rejects_values_outside_provider_context_boundary(
    value: object,
) -> None:
    from app.core.ai.training_block_prompt_v1 import render_training_block_prompt

    with pytest.raises(TypeError, match="provider_generation_context_required"):
        render_training_block_prompt(value)  # type: ignore[arg-type]
