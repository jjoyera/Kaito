import json
from datetime import date
from decimal import Decimal

import pytest

from app.modules.planning.generation_context import (
    ProviderAvailabilityDay,
    ProviderGenerationContext,
    ProviderGoalContext,
    ProviderReadinessContext,
    ProviderSafetyContext,
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
    assert "Return only the structured GeneratedTrainingBlock schema." in rendered


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
