"""OpenAI Responses API adapter for a validated generated training block."""

import logging
import time
from typing import Any

import openai
from pydantic import ValidationError

from app.core.ai.training_block_prompt_v1 import (
    PROMPT_VERSION,
    render_training_block_prompt,
)
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
from app.observability.training_generation import (
    capture_provider_attempt,
    capture_provider_failure,
    diagnostic_capture_active,
    record_provider_response_outcome,
)

logger = logging.getLogger(__name__)

_EVENT_PREFIX = "kaito.openai_training_block"
_OPERATION = "training_block.generate"
_SAFE_PROVIDER_CODES = frozenset(
    {
        "content_filter",
        "context_length_exceeded",
        "insufficient_quota",
        "invalid_prompt",
        "invalid_request_error",
        "model_not_found",
        "rate_limit_exceeded",
        "server_error",
        "unsupported_value",
    }
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
        started_at = time.perf_counter()
        prompt = ""
        structured_schema = _diagnostic_structured_schema()
        try:
            prompt = render_training_block_prompt(context)
            response = self._client.responses.parse(
                model=self._model,
                input=prompt,
                text_format=GeneratedTrainingBlock,
            )
        except openai.APITimeoutError as error:
            metadata = _safe_error_metadata(error)
            capture_provider_failure(
                prompt_version=PROMPT_VERSION,
                model=self._model,
                prompt=prompt,
                structured_schema=structured_schema,
                elapsed_ms=_elapsed_ms(started_at),
                category="timeout",
                status=_metadata_int(metadata, "http_status"),
                code=_metadata_str(metadata, "provider_error_code"),
            )
            _log_provider_event(
                level=logging.ERROR,
                event="timeout",
                outcome="timeout",
                model=self._model,
                started_at=started_at,
                **metadata,
            )
            raise TrainingGenerationTimeout() from None
        except openai.APIError as error:
            metadata = _safe_error_metadata(error)
            capture_provider_failure(
                prompt_version=PROMPT_VERSION,
                model=self._model,
                prompt=prompt,
                structured_schema=structured_schema,
                elapsed_ms=_elapsed_ms(started_at),
                category="api_error",
                status=_metadata_int(metadata, "http_status"),
                code=_metadata_str(metadata, "provider_error_code"),
            )
            _log_provider_event(
                level=logging.ERROR,
                event="api_error",
                outcome="api_error",
                model=self._model,
                started_at=started_at,
                **metadata,
            )
            raise TrainingGenerationUnavailable() from None
        except (ValidationError, ValueError) as error:
            capture_provider_failure(
                prompt_version=PROMPT_VERSION,
                model=self._model,
                prompt=prompt,
                structured_schema=structured_schema,
                elapsed_ms=_elapsed_ms(started_at),
                category="invalid_response",
            )
            _log_provider_event(
                level=logging.ERROR,
                event="invalid_response",
                outcome="invalid_response",
                model=self._model,
                started_at=started_at,
                exception_class=type(error).__name__,
                invalid_reason="parse_error",
            )
            raise TrainingGenerationInvalidResponse() from None

        parsed = _parsed_output(response)
        capture_provider_attempt(
            prompt_version=PROMPT_VERSION,
            model=self._model,
            prompt=prompt,
            structured_schema=structured_schema,
            raw_response=response,
            parsed=parsed,
            elapsed_ms=_elapsed_ms(started_at),
        )
        if _contains_refusal(response):
            record_provider_response_outcome("refused")
            _log_provider_event(
                level=logging.ERROR,
                event="refusal",
                outcome="refusal",
                model=self._model,
                started_at=started_at,
            )
            raise TrainingGenerationRefused()
        if getattr(response, "status", None) == "incomplete":
            record_provider_response_outcome("incomplete")
            _log_invalid_response(
                model=self._model,
                started_at=started_at,
                reason="incomplete_status",
            )
            raise TrainingGenerationInvalidResponse()

        if type(parsed) is not GeneratedTrainingBlock:
            record_provider_response_outcome("invalid_response")
            _log_invalid_response(
                model=self._model,
                started_at=started_at,
                reason=(
                    "missing_parsed_output"
                    if parsed is None
                    else "parsed_type_mismatch"
                ),
            )
            raise TrainingGenerationInvalidResponse()
        _log_provider_event(
            level=logging.INFO,
            event="completed",
            outcome="completed",
            model=self._model,
            started_at=started_at,
        )
        return parsed


def _diagnostic_structured_schema() -> object:
    if not diagnostic_capture_active():
        return None
    try:
        from openai.lib._parsing._responses import type_to_text_format_param

        return type_to_text_format_param(GeneratedTrainingBlock)
    except Exception:
        return None


def _elapsed_ms(started_at: float) -> int:
    return max(0, round((time.perf_counter() - started_at) * 1000))


def _metadata_int(metadata: dict[str, object], key: str) -> int | None:
    value = metadata.get(key)
    return value if isinstance(value, int) else None


def _metadata_str(metadata: dict[str, object], key: str) -> str | None:
    value = metadata.get(key)
    return value if isinstance(value, str) else None


def _log_invalid_response(*, model: str, started_at: float, reason: str) -> None:
    _log_provider_event(
        level=logging.ERROR,
        event="invalid_response",
        outcome="invalid_response",
        model=model,
        started_at=started_at,
        invalid_reason=reason,
    )


def _safe_error_metadata(error: openai.APIError) -> dict[str, object]:
    metadata: dict[str, object] = {"exception_class": type(error).__name__}
    status = getattr(error, "status_code", None)
    if isinstance(status, int) and 100 <= status <= 599:
        metadata["http_status"] = status
    code = getattr(error, "code", None)
    if isinstance(code, str) and code in _SAFE_PROVIDER_CODES:
        metadata["provider_error_code"] = code
    return metadata


def _log_provider_event(
    *,
    level: int,
    event: str,
    outcome: str,
    model: str,
    started_at: float,
    **metadata: object,
) -> None:
    event_name = f"{_EVENT_PREFIX}.{event}"
    fields: dict[str, object] = {
        "event_name": event_name,
        "provider": "openai",
        "operation": _OPERATION,
        "model": model,
        "outcome": outcome,
        "elapsed_ms": _elapsed_ms(started_at),
        **metadata,
    }
    local_fields = " ".join(
        f"{key}={value}" for key, value in fields.items() if key != "event_name"
    )
    logger.log(level, f"{event_name} {local_fields}", extra=fields)


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
