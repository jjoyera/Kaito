"""OpenAI Responses API adapter for a validated generated training block."""

from typing import Any

import openai
from pydantic import ValidationError

from app.core.ai.training_block_prompt_v1 import render_training_block_prompt
from app.core.config import (
    PINNED_OPENAI_MODEL,
    build_openai_client,
    get_openai_settings,
)
from app.modules.planning.generation_context import ProviderGenerationContext
from app.modules.planning.generation_contract import GeneratedTrainingBlock
from app.modules.planning.generation_provider import (
    TrainingGenerationInvalidResponse,
    TrainingGenerationRefused,
    TrainingGenerationTimeout,
    TrainingGenerationUnavailable,
)


class OpenAITrainingBlockProvider:
    """Request one structured block using the single approved model snapshot."""

    def __init__(self, client: Any, *, model: str = PINNED_OPENAI_MODEL) -> None:
        if model != PINNED_OPENAI_MODEL:
            raise ValueError("openai_model_not_allowed")
        self._client = client
        self._model = model

    @classmethod
    def from_environment(cls) -> "OpenAITrainingBlockProvider":
        """Construct the adapter only when provider configuration is requested."""
        settings = get_openai_settings()
        return cls(build_openai_client(), model=settings.model)

    def generate(self, context: ProviderGenerationContext) -> GeneratedTrainingBlock:
        if not isinstance(context, ProviderGenerationContext):
            raise TypeError("provider_generation_context_required")
        try:
            response = self._client.responses.parse(
                model=self._model,
                input=render_training_block_prompt(context),
                text_format=GeneratedTrainingBlock,
            )
        except openai.APITimeoutError:
            raise TrainingGenerationTimeout() from None
        except openai.APIError:
            raise TrainingGenerationUnavailable() from None
        except (ValidationError, ValueError):
            raise TrainingGenerationInvalidResponse() from None

        if _contains_refusal(response):
            raise TrainingGenerationRefused()
        if getattr(response, "status", None) == "incomplete":
            raise TrainingGenerationInvalidResponse()

        parsed = _parsed_output(response)
        if type(parsed) is not GeneratedTrainingBlock:
            raise TrainingGenerationInvalidResponse()
        return parsed


def _contains_refusal(response: object) -> bool:
    return any(
        getattr(content, "type", None) == "refusal"
        for item in (getattr(response, "output", None) or ())
        for content in (getattr(item, "content", None) or ())
    )


def _parsed_output(response: object) -> object | None:
    direct = getattr(response, "output_parsed", None)
    if direct is not None:
        return direct
    for item in (getattr(response, "output", None) or ()):
        for content in (getattr(item, "content", None) or ()):
            parsed = getattr(content, "parsed", None)
            if parsed is not None:
                return parsed
    return None
