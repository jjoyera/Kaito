"""Deterministic, versioned prompt for structured training-block generation."""

import json

from app.modules.planning.generation_context import ProviderGenerationContext

PROMPT_VERSION = "training-block-v1"
PROMPT_INSTRUCTIONS = (
    "Generate the next bounded training block from the provided backend context.\n"
    "The backend-owned authorized approach is a constraint, not a choice.\n"
    "Dates, weekly running distance, availability, session trajectory, readiness, "
    "and sports restrictions are constraints, not choices.\n"
    "Satisfy every machine-readable rule in rules and every per-week constraint; "
    "booleans are mandatory instructions, not informational hints.\n"
    "Use availability minutes as an aggregate daily budget across all sessions.\n"
    "A readiness status of not_feasible forbids every demanding session as defined "
    "by rules.sports_policy; it does not permit inventing a harder alternative.\n"
    "Do not diagnose medical conditions.\n"
    "Do not invent missing data.\n"
    "Return only the structured GeneratedTrainingBlock schema."
)


def render_training_block_prompt(context: ProviderGenerationContext) -> str:
    """Serialize only the provider-safe context into the fixed v1 prompt."""
    if not isinstance(context, ProviderGenerationContext):
        raise TypeError("provider_generation_context_required")
    serialized_context = json.dumps(
        context.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return (
        f"prompt_version: {PROMPT_VERSION}\n"
        f"instructions:\n{PROMPT_INSTRUCTIONS}\n"
        f"provider_generation_context_json:\n{serialized_context}"
    )
