"""Provider-neutral port and failures for structured training-block generation."""

from typing import Protocol

from app.modules.planning.generation_context import ProviderGenerationContext
from app.modules.planning.generation_contract import GeneratedTrainingBlock


class TrainingGenerationTimeout(Exception):
    def __init__(self) -> None:
        super().__init__("generation_timeout")


class TrainingGenerationRefused(Exception):
    def __init__(self) -> None:
        super().__init__("generation_refused")


class TrainingGenerationInvalidResponse(Exception):
    def __init__(self) -> None:
        super().__init__("generation_invalid_response")


class TrainingGenerationUnavailable(Exception):
    def __init__(self) -> None:
        super().__init__("generation_provider_unavailable")


class TrainingBlockGenerationProvider(Protocol):
    """Generate one validated block from the provider-safe context only."""

    def generate(
        self, context: ProviderGenerationContext
    ) -> GeneratedTrainingBlock: ...
